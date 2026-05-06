import { useState, useRef, type MouseEvent, useEffect } from "react";
import { type Point, snapToPoints, type Wall, type Room, isSamePoint, snapToAnything, constructRoom, copyWall, copyRoom, roomBehavior, wallBehavior, getBehavior, type GeometryObject, constructPoint, constructWall, copyGeometryObject } from "../utils/geometry";
import './RoomLayoutViewer.css'
import ContextMenu from "./ContextMenu";
import { checkEnterKey } from "../utils/input";
import { getLayout, putLayout, type Floor } from "../services/RoomLayoutService";


interface RoomLayoutViewerProps {
    onlyView: Boolean
}

const RoomLayoutViewer: React.FC<RoomLayoutViewerProps> = ({onlyView}) => {
  const [walls, setWalls] = useState<Wall[]>([]);
  const [draftWall, setDraftWall] = useState<Wall | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [draftRoom, setDraftRoom] = useState<Room | null>(null);

  // Floor, der verwendet wird, wenn es keine anderen gibt
  const initialFloor = { id: crypto.randomUUID(), label: "Floor 1" }

  const [floors, setFloors] = useState<Floor[]>([initialFloor] );
  const [selectedFloorId, setSelectedFloorId] = useState<string>(initialFloor.id);
  const [editingFloorLabelId, setEditingFloorLabelId] = useState<string | null>(null);

  const [selectedGeometryObject, setSelectedMovable] = useState<GeometryObject | null>(null);

  const [tool, setTool] = useState<"wall" | "room" | "select" | "zoom-in" | "zoom-out">("wall");
  const [zoom, setZoom] = useState(1);
  const [canvasBounds, setCanvasBounds] = useState({ minX: 0, minY: 0, width: 1600, height: 1200 });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [contextMenuItems, setContextMenuItems] = useState(getDefaultContextMenuItems);
  const contextMenuModeRef = useRef<'default' | 'wall' | 'room' | 'floor'>('default');

  const visibleWalls = walls.filter(w => w.floorId === selectedFloorId);
  const visibleRooms = rooms.filter(r => r.floorId === selectedFloorId);

  const snapPointsRef = useRef<Point[]>([]); // Alle Punkte, an die gerade gesnapped werden kann. Wird bei jedem MouseDown neu berechnet.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const initialMousePos = useRef<Point | null>(null);
  const initialGOPos = useRef<GeometryObject | null>(null);
  const initialDefiningPointPos = useRef<Point | null>(null);

  const CANVAS_MARGIN = 200;
  const ZOOM_STEP = 1.2;
  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 3;

  useEffect(() => {
    // Überschreibe mit Gespeicherten Daten aus der Datenbank
    getLayout().then((layout) => {
      setFloors(layout.floors);
      setRooms(layout.rooms);
      setWalls(layout.walls);
      if(layout.floors.length > 0){
        setSelectedFloorId(layout.floors[0].id);
      }
    })

    if(editorContainerRef.current)
      editorContainerRef.current.scrollTo({
        left: 360,
        top: 290
      });
  }, []); // läuft nur einmal beim Mount

  function getMousePos(e: MouseEvent): Point {
    if(svgRef.current == null) return constructPoint(Number.MIN_VALUE, Number.MIN_VALUE)

    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; // Prozentsatz: Wie viel von dem SVG hab ich "durchquert"
    const y = (e.clientY - rect.top) / rect.height;

    return constructPoint(
      canvasBounds.minX + x * canvasBounds.width, // Position innerhalb der canvasWelt. Kann auch negativ sein.
      canvasBounds.minY + y * canvasBounds.height
    );
  }

  function handleMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if(editingFloorLabelId && !target.classList.contains("floor-input")) { // Aus "Renaming" eines Floors rausgehen
      setEditingFloorLabelId(null)
    }

    if (target.tagName.toLowerCase() === "input") return; // Input-Elemente sollen kein Zeichnen auslösen können


    // Deselect if clicking on empty space
    if (tool === "select" && target.tagName.toLowerCase() === "svg") {
      setSelectedMovable(null);
    }

    if (tool === "zoom-in" || tool === "zoom-out") {
      if(editorContainerRef.current == null) return;

      const nextZoom = tool === "zoom-in" ? Math.min(zoom * ZOOM_STEP, ZOOM_MAX) : Math.max(zoom / ZOOM_STEP, ZOOM_MIN);
      // Viewport muss sich auch ändern
      const maxScrollLeft = canvasBounds.width * nextZoom - editorContainerRef.current.clientWidth; // Maybe unnötig, weil automatisch geclampt wird
      const scrollLeftByFormula = (editorContainerRef.current.scrollLeft + editorContainerRef.current.clientWidth/2) * nextZoom / zoom - editorContainerRef.current.clientWidth/2;
      editorContainerRef.current.scrollLeft = Math.min(scrollLeftByFormula, maxScrollLeft);

      const maxScrollTop = canvasBounds.height * nextZoom - editorContainerRef.current.clientHeight; // Maybe unnötig, weil automatisch geclampt wird
      const scrollTopByFormula = (editorContainerRef.current.scrollTop + editorContainerRef.current.clientHeight/2) * nextZoom / zoom - editorContainerRef.current.clientHeight/2;
      editorContainerRef.current.scrollTop = Math.min(scrollTopByFormula, maxScrollTop);
      // Kleiner Bug: Wenn ich selber scrolle und dann reinzoome, wird trotzdem die alte Position verwendet.
      setZoom(nextZoom);
      return;
    }

    snapPointsRef.current = calculateSnapPoints();

    if (tool == "wall"){

      const pos = getMousePos(e);
      const snappedPoint = snapEnabled ? snapToAnything(pos, snapPointsRef.current, pos) : pos;
      
      setDraftWall(constructWall(crypto.randomUUID(), 
        constructPoint(snappedPoint.x, snappedPoint.y), 
        constructPoint(snappedPoint.x, snappedPoint.y), selectedFloorId));
    } 
    else if (tool == "room") {
      const pos = getMousePos(e);
      const snapped = snapEnabled ? snapToPoints(pos, snapPointsRef.current)[0] : pos;

      setDraftRoom(constructRoom(crypto.randomUUID(), 
        constructPoint(snapped.x, snapped.y), 
        constructPoint(snapped.x, snapped.y), selectedFloorId));
    }
  }

  function getDefaultContextMenuItems() {
    return [
      { label: "Clear Walls", onClick: () => setWalls([]) },
      { label: "Export JSON", onClick: () => alert(JSON.stringify({ floors, walls, rooms }, null, 2)) }
    ];
  }

  function deleteWall(id: string) {
    setWalls(prev => prev.filter(w => w.id !== id));
    if(selectedGeometryObject && selectedGeometryObject.id === id){
      setSelectedMovable(null)
    }
  }

  function deleteRoom(id: string) {
    setRooms(prev => prev.filter(r => r.id !== id));
    if(selectedGeometryObject && selectedGeometryObject.id === id){
      setSelectedMovable(null)
    }
  }

  function addFloor() {
    const nextFloorId = crypto.randomUUID();
    setFloors(prev => [...prev, { id: nextFloorId, label: `Floor ${prev.length + 1}` }]);
    setSelectedFloorId(nextFloorId);
    setSelectedMovable(null);
  }

  function deleteFloor(id: string){
    if (floors.length <= 1) return;
    if(selectedFloorId === id){
      setSelectedMovable(null);
      const remainingFloors = floors.filter(f => f.id !== id);
      if (remainingFloors.length > 0) {
        setSelectedFloorId(remainingFloors[0].id);
      }
    }
    setFloors(prev => prev.filter(f => f.id !== id));
    setWalls(prev => prev.filter(w => w.floorId !== id));
    setRooms(prev => prev.filter(r => r.floorId !== id));
  }

  function handleWallContextMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    contextMenuModeRef.current = 'wall';
    setContextMenuItems([
      { label: "Delete", onClick: () => deleteWall(id) },
      ...getDefaultContextMenuItems()
    ]);
  }

  function handleRoomContextMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    contextMenuModeRef.current = 'room';
    setContextMenuItems([
      { label: "Delete", onClick: () => deleteRoom(id) },
      ...getDefaultContextMenuItems()
    ]);
  }

  function handleFloorContextMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    contextMenuModeRef.current = 'floor';
    const lastFloor = floors.length <= 1;
    const additionalMenuItems = []
    if(!lastFloor){
      additionalMenuItems.push({ label: "Delete", onClick: () => deleteFloor(id) });
    }
    additionalMenuItems.push({ label: "Rename", onClick: () => setEditingFloorLabelId(id) });
    setContextMenuItems([
      ...additionalMenuItems, 
      ...getDefaultContextMenuItems()
    ])
  }

  /**
   * Die Methode wird aufgerufen, wenn auf irgendwas im SVG rechtsgeklickt wird.
   * Gilt auch für Walls und Rooms. Deren Kontextmenüs werden aber zuerst aufgerufen wegen bubbling.
   */
  function handleEditorContextMenu() {
    if (contextMenuModeRef.current !== 'default') {
      contextMenuModeRef.current = 'default';
      return;
    }

    setContextMenuItems(getDefaultContextMenuItems());
  }

  function handleMouseMove(e: MouseEvent) {
    if (draftWall){
      const pos = getMousePos(e);
      const snappedPoint = snapEnabled ? snapToAnything(pos, snapPointsRef.current, draftWall.p1) : pos;

      setDraftWall(constructWall(draftWall.id, draftWall.p1, constructPoint(snappedPoint.x, snappedPoint.y), draftWall.floorId));
    } 
    else if (draftRoom){
      const pos = getMousePos(e);
      const snappedPoint = snapEnabled ? snapToPoints(pos, snapPointsRef.current)[0] : pos;

      setDraftRoom(constructRoom(draftRoom.id, draftRoom.p1, constructPoint(snappedPoint.x, snappedPoint.y), draftRoom.floorId));
    }
  }

  function handleMouseUp() {
    if (draftWall){ 
      if(draftWall.p1.x === draftWall.p2.x && draftWall.p1.y === draftWall.p2.y) {
        setDraftWall(null);
        return; // Keine Mauern mit 0 Länge erlauben
      }

      const nextWall = copyWall(draftWall, {floorId: selectedFloorId});
      setWalls(prev => [...prev, nextWall]);
      expandCanvasIfNeeded(wallBehavior.getSnappablePoints(nextWall));
      setDraftWall(null);
    } 
    else if ( draftRoom) {
      if(draftRoom.p1.x === draftRoom.p2.x || draftRoom.p1.y === draftRoom.p2.y) {
        setDraftRoom(null);
        return; // Keine Räume mit 0 Fläche erlauben
      }

      const nextRoom = copyRoom(draftRoom, {floorId: selectedFloorId});
      setRooms(prev => [...prev, nextRoom]);
      expandCanvasIfNeeded(roomBehavior.getSnappablePoints(nextRoom));
      setDraftRoom(null);
    }
  }

  function calculateSnapPoints(excluded: Point[] = []): Point[]{
    let points: Point[] = []


    points = points.concat(visibleWalls.flatMap(wall => wallBehavior.getSnappablePoints(wall)));
    points = points.concat(visibleRooms.flatMap(room => roomBehavior.getSnappablePoints(room)));

    // visibleWalls.forEach(wall => {
    //   if(excluded.includes(wall)) return; // Ganze Wand ausgeschlossen -> beide Endpunkte ignorieren

    //   points = points.concat(wall.getSnappablePoints())
    // });

    points = points.filter(p =>
      !excluded.some(e => isSamePoint(e, p)) // Only non-excluded
    );

    return points
  }

  function expandCanvasIfNeeded(points: Point[]) {
    setCanvasBounds(prev => {
      let minX = prev.minX;
      let minY = prev.minY;
      let maxX = prev.minX + prev.width;
      let maxY = prev.minY + prev.height;
      let changed = false;

      points.forEach(point => {
        if (point.x < minX + CANVAS_MARGIN) {
          minX = Math.min(minX, point.x - CANVAS_MARGIN);
          changed = true;
        }
        if (point.y < minY + CANVAS_MARGIN) {
          minY = Math.min(minY, point.y - CANVAS_MARGIN);
          changed = true;
        }
        if (point.x > maxX - CANVAS_MARGIN) {
          maxX = Math.max(maxX, point.x + CANVAS_MARGIN);
          changed = true;
        }
        if (point.y > maxY - CANVAS_MARGIN) {
          maxY = Math.max(maxY, point.y + CANVAS_MARGIN);
          changed = true;
        }
      });

      if (!changed) return prev;
      return {
        minX,
        minY,
        width: Math.max(800, maxX - minX),
        height: Math.max(600, maxY - minY)
      };
    });
  }

  /**
   * @param movable movable To move.
   * @param currentMouse current mouse position. Used in par with initialMovablePos to calculate the delta.
   * @returns the updated movable.
   */
  function moveDefiningPoint(movable: GeometryObject, indexOfDefiningPoint: number, currentMouse: Point): Wall | Room {
    if (!initialMousePos.current || !initialDefiningPointPos.current) return movable;

    const dx = currentMouse.x - initialMousePos.current.x;
    const dy = currentMouse.y - initialMousePos.current.y;

    // Is used to snap to an axis that fixedPoint lies on
    let fixedPoint: Point | null = 
      movable.type === "wall"
        ? wallBehavior.getDefiningPoints(movable)[1-indexOfDefiningPoint]
        : null;

    // move the defining point and construct a new movable out of it
    const updatedPoint = updatePoint(initialDefiningPointPos.current, dx, dy, fixedPoint);

    if (updatedPoint) {
      if (movable.type === "wall") {
        const updatedMovable = wallBehavior.setDefiningPoints(movable, wallBehavior.getDefiningPoints(movable)
          .map((point, index) =>
            index === indexOfDefiningPoint
              ? updatedPoint
              : point));

        setWalls(prev =>
          prev.map(w => {
            return w.id === movable.id ? updatedMovable : w;
          })
        );
        expandCanvasIfNeeded(wallBehavior.getSnappablePoints(updatedMovable));
        return updatedMovable;
      } 
      else if (movable.type === "room") {
        const updatedMovable = roomBehavior.setDefiningPoints(movable, roomBehavior.getDefiningPoints(movable)
          .map((point, index) =>
            index === indexOfDefiningPoint
              ? updatedPoint
              : point));

        setRooms(prev =>
          prev.map(r => (r.id === movable.id ? updatedMovable as Room : r))
        );
        expandCanvasIfNeeded(roomBehavior.getSnappablePoints(updatedMovable));
        return updatedMovable;
      }
    }
    return copyGeometryObject(movable, {})
  }

  /**
   * @param geometryObject geometryObject To move.
   * @param currentMouse current mouse position. Used in par with initialMovablePos to calculate the delta.
   * @returns the updated movable.
   */
  function moveGeometryObject(geometryObject: GeometryObject, currentMouse: Point): GeometryObject {
    if (!initialMousePos.current || !initialGOPos.current) return geometryObject;
    const dx = currentMouse.x - initialMousePos.current.x;
    const dy = currentMouse.y - initialMousePos.current.y;
    const updated = updateGeometryObject(initialGOPos.current, dx, dy);
    if (updated) {
      if(updated.type == "wall"){
        setWalls(prev =>
          prev.map(w => {
            return w.id === updated.id ? updated : w;
          })
        );
        expandCanvasIfNeeded(wallBehavior.getSnappablePoints(updated));
      } else if(updated.type == "room"){
        setRooms(prev =>
          prev.map(r => (r.id === updated.id ? updated : r))
        );
        expandCanvasIfNeeded(roomBehavior.getSnappablePoints(updated));
      }
      
      return updated;
    }
    return geometryObject; // If nothing changed
  }

  // fixedPoint: Eventuell ein Punkt, dessen Achsen snappable sein sollen.
  function updatePoint(initialPoint: Point, dx: number, dy: number, fixedPoint: Point | null = null): Point {
    let movedPoint = {...initialPoint};

    movedPoint.x += dx;
    movedPoint.y += dy;

    if(!snapEnabled) return movedPoint;

    return fixedPoint 
      ? snapToAnything(movedPoint, snapPointsRef.current, fixedPoint) 
      : snapToPoints(movedPoint, snapPointsRef.current)[0];
  }

  function updateGeometryObject(initialGO: GeometryObject, dx: number, dy: number): GeometryObject {
    let movedGO = copyGeometryObject(initialGO, {});

    // definierende Punkte initialisieren
    let initialDefiningPoints = getBehavior(initialGO).getDefiningPoints(initialGO);
    let movedGODefiningPoints = getBehavior(movedGO).getDefiningPoints(movedGO);

    // Verschiebe alle Punkte
    for(let i = 0; i < initialDefiningPoints.length; i++) {
      movedGODefiningPoints[i].x = initialDefiningPoints[i].x + dx;
      movedGODefiningPoints[i].y = initialDefiningPoints[i].y + dy;
    }

    if(!snapEnabled) return movedGO;

    // # Snapping
    // ## Endpunkte extrahieren
    let snappingPoints = getBehavior(movedGO).getSnappingPoints(movedGO);
    let snappedPoints: Point[] = []; // Array für gesnappte Punkte, oder die Punkte selbst, wenn sie nicht gesnapped wurden.

    snappingPoints.forEach(p => { // Versuch, jeden Punkt des zu bewegenden Elements zu snappen
      snappedPoints.push(snapToPoints(p, snapPointsRef.current)[0]);
    });

    for (let index = 0; index < snappedPoints.length; index++) {
      const snappedPoint = snappedPoints[index];

      if (!isSamePoint(snappedPoint, snappingPoints[index])) { // Wenn dieser Punkt gesnapped ist -> Alle anderen Punkte genauso verschieben
        let snappingDeltaX = snappedPoint.x - snappingPoints[index].x;
        let snappingDeltaY = snappedPoint.y - snappingPoints[index].y;

        getBehavior(movedGO).getDefiningPoints(movedGO).forEach(p => {
          p.x += snappingDeltaX;
          p.y += snappingDeltaY;
        });

        break; // // Nur ein Punkt soll snappen, danach ist die Verschiebung für alle Punkte festgelegt
      }
    }

    return movedGO;
  }


  function onMouseDownOnDefiningPoint(e: MouseEvent, movable: GeometryObject, indexOfPoint: number) {
    if(tool !== "select") return;

    e.stopPropagation();

    initialMousePos.current = getMousePos(e);
    initialDefiningPointPos.current = {...getBehavior(movable).getDefiningPoints(movable)[indexOfPoint]} // Just for calculation

    snapPointsRef.current = calculateSnapPoints(getBehavior(movable).getSnappablePoints(movable));

    function onMove(event: any): void {
      const currentMouse = getMousePos(event);
      const updatedMovable = moveDefiningPoint(movable, indexOfPoint, currentMouse)
      setSelectedMovable(updatedMovable) // Für updates der Defining-Points im UI
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      initialMousePos.current = null;
      initialGOPos.current = null;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    // WIP
  }

  function onMouseDownOnMovable(e: MouseEvent, geometryObject: GeometryObject) {
    if(tool !== "select") return;

    // Mouse should only target the movable
    e.stopPropagation();
    
    // Initialize moving
    setSelectedMovable(geometryObject);
    initialMousePos.current = getMousePos(e);
    initialGOPos.current = copyGeometryObject(geometryObject, {}); // Kopie erstellen, damit die ursprüngliche Position für die Berechnung der Verschiebung erhalten bleibt

    if(geometryObject.type === "wall"){
      snapPointsRef.current = wallBehavior.getSnappablePoints(geometryObject)
    }

    snapPointsRef.current = calculateSnapPoints(getBehavior(geometryObject).getSnappablePoints(geometryObject));

    function onMove(event: any) {
      const currentMouse = getMousePos(event);
      const updatedMovable = moveGeometryObject(geometryObject, currentMouse);
      setSelectedMovable(updatedMovable) // Für updates der Defining-Points im UI
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      initialMousePos.current = null;
      initialGOPos.current = null;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }



  function changeRoomName(r: Room, value: string): void {
    setRooms(prev => 
      prev.map(room => room.id === r.id 
        ? copyRoom(room, {label: value})
        : room));
  }

  function changeFloorName(f: Floor, value: string): void {
    setFloors(prev =>
      prev.map(floor => floor.id === f.id
        ? {...floor, label: value}
        : floor
    ));
  }

  function changeFloorTo(floor: Floor){
    setSelectedFloorId(floor.id);
    setSelectedMovable(null);
  }

  function saveLayout(): void {
    putLayout({floors: floors, walls: walls, rooms: rooms}).then(layout => {
      setFloors(layout.floors);
      setWalls(layout.walls);
      setRooms(layout.rooms);
    }).catch(console.error);
  }

  return (
    <>
      <ContextMenu
        items={contextMenuItems}
        onContextMenu={handleEditorContextMenu}
      >
        <div className="editor-wrapper">
          
          <div className="toolbar">
            <div className="toolbar-left">
              <button className={`select-button ${tool == "select" ? "active" : ""}`} onClick={() => setTool("select")}>
                Select
              </button>
              <button className={`select-button ${tool == "wall" ? "active" : ""}`} onClick={() => setTool("wall")}>
                Wall
              </button>
              <button className={`select-button ${tool == "room" ? "active" : ""}`} onClick={() => setTool("room")}>
                Room
              </button>
              <button className={`select-button ${tool == "zoom-in" ? "active" : ""}`} onClick={() => setTool("zoom-in")}>
                Zoom In
              </button>
              <button className={`select-button ${tool == "zoom-out" ? "active" : ""}`} onClick={() => setTool("zoom-out")}>
                Zoom Out
              </button>
              <button className={'select-button'} onClick={() => saveLayout()}>
                Save
              </button>
            </div>

            <div className="toolbar-right">
              <button className="button-snap" onClick={() => setSnapEnabled(!snapEnabled)}>
                Snap: {snapEnabled ? "ON" : "OFF"}
              </button>
              <button className="button-zoom-level" onClick={() => null}>
                Zoom: {Math.round(zoom * 100)}%
              </button>
            </div>

          </div>
          <div className="floor-select">
            {floors.map(floor => (
              <button className={`floor-button ${selectedFloorId === floor.id ? "active" : ""}`} 
                onClick={() => changeFloorTo(floor)}
                onContextMenu={(e) => handleFloorContextMenu(e, floor.id)}>
                {editingFloorLabelId === floor.id 
                  ? (
                    <input 
                      className="floor-input" 
                      defaultValue={floor.label}
                      onChange={(e) => changeFloorName(floor, e.target.value)}
                      onKeyDown={(e) => checkEnterKey(e, () => setEditingFloorLabelId(null))}/>
                  )
                  : floor.label }
              </button>
            ))}

            <button className="floor-button" onClick={addFloor}>
              +
            </button>
          </div>
          <div 
            ref={editorContainerRef}
            className="editor-container">

            <svg
              ref={svgRef}
              width={canvasBounds.width * zoom}
              height={canvasBounds.height * zoom}
              viewBox={`${canvasBounds.minX} ${canvasBounds.minY} ${canvasBounds.width} ${canvasBounds.height}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{
                display: "block",
                background: "#0a2540",
                backgroundImage:
                  "linear-gradient( #1e3a5f 1px, transparent 1px), linear-gradient(90deg, #1e3a5f 1px, transparent 1px)",
                backgroundSize: "20px 20px"
              }}
            >

              {/* Bestehende Räume*/}
              {visibleRooms.map(r => (
                <g 
                  key={r.id}
                  onMouseDown={(e) => onMouseDownOnMovable(e, r)}
                  onContextMenu={(e) => handleRoomContextMenu(e, r.id)}>
                  <rect
                    x={Math.min(r.p1.x, r.p2.x)}
                    y={Math.min(r.p1.y, r.p2.y)}
                    width={Math.abs(r.p2.x - r.p1.x)}
                    height={Math.abs(r.p2.y - r.p1.y)}
                    fill="rgba(0, 255, 255, 0.3)"
                    stroke={selectedGeometryObject && selectedGeometryObject.id === r.id ? "yellow" : "cyan"}
                    strokeWidth={selectedGeometryObject && selectedGeometryObject.id === r.id ? "3" : "2"}
                  />
                  <foreignObject
                    x={Math.min(r.p1.x, r.p2.x)}
                    y={Math.min(r.p1.y, r.p2.y)}
                    width={Math.abs(r.p2.x - r.p1.x)}
                    height={Math.abs(r.p2.y - r.p1.y)}
                  >
                    <div style={{width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center"}}>
                      <input
                      value={r.label}
                      type="text" 
                      placeholder="Raumname" 
                      className="room-name-input"
                      onChange={(e) => changeRoomName(r, e.target.value)}/>
                    </div>
                  </foreignObject> 
                </g>
              ))}
              {/* bestehende Wände */}
              {visibleWalls.map(w => (
                <line
                  key={w.id}
                  x1={w.p1.x}
                  y1={w.p1.y}
                  x2={w.p2.x}
                  y2={w.p2.y}
                  stroke={selectedGeometryObject && selectedGeometryObject.id === w.id ? "yellow" : "white"}
                  strokeWidth={selectedGeometryObject && selectedGeometryObject.id === w.id ? "6" : "4"}
                  onMouseDown={(e) => onMouseDownOnMovable(e, w)}
                  onContextMenu={(e) => handleWallContextMenu(e, w.id)}
                />
              ))}

              {/* Wand-Vorschau */}
              {draftWall && (
                <line
                  x1={draftWall.p1.x}
                  y1={draftWall.p1.y}
                  x2={draftWall.p2.x}
                  y2={draftWall.p2.y}
                  stroke="cyan"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              )}

              {/* Raumvorschau */}
              {draftRoom && (
                <rect
                  x={Math.min(draftRoom.p1.x, draftRoom.p2.x)}
                  y={Math.min(draftRoom.p1.y, draftRoom.p2.y)}
                  width={Math.abs(draftRoom.p2.x - draftRoom.p1.x)}
                  height={Math.abs(draftRoom.p2.y - draftRoom.p1.y)}
                  fill="rgba(0, 255, 255, 0.3)"
                  stroke="cyan"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              )}

              {/* Selection handles */}
              {selectedGeometryObject && getBehavior(selectedGeometryObject)
                .getDefiningPoints(selectedGeometryObject).map((point, index) => (
                <circle
                  key={`handle-${selectedGeometryObject.id}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r="8"
                  fill="yellow"
                  stroke="black"
                  strokeWidth="1"
                  style={{ cursor: 'pointer' }}
                  onMouseDown={(e) => onMouseDownOnDefiningPoint(e, selectedGeometryObject, index)}
                />
              ))}
            </svg>
          </div>
        </div>
      </ContextMenu>
    </>
  );
}

export default RoomLayoutViewer;