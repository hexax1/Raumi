import { useState, useRef, type MouseEvent, useEffect } from "react";
import { Point, snapPoint, Wall, Room, isSamePoint, type Movable } from "../utils/geometry";
import './RoomEditor.css'
import ContextMenu from "./ContextMenu";
import { checkEnterKey } from "../utils/input";

type Floor = {
  id: number;
  label: string;
};

const RoomEditor: React.FC = () => {
  const [walls, setWalls] = useState<Wall[]>([]);
  const [draftWall, setDraftWall] = useState<Wall | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [draftRoom, setDraftRoom] = useState<Room | null>(null);

  const [floors, setFloors] = useState<Floor[]>([{ id: 1, label: "Floor 1" }] );
  const [selectedFloorId, setSelectedFloorId] = useState<number>(1);
  const [editingFloorLabelId, setEditingFloorLabelId] = useState<number | null>(null);

  const [selectedMovable, setSelectedMovable] = useState<Movable | null>(null);

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
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const initialMousePos = useRef<Point | null>(null);
  const initialMovablePos = useRef<Movable | null>(null);
  const initialDefiningPointPos = useRef<Point | null>(null);

  const CANVAS_MARGIN = 200;
  const ZOOM_STEP = 1.2;
  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 3;

  useEffect(() => {
    editorContainerRef.current.scrollTo({
      left: 360,
      top: 290
    });
  }, []); // läuft nur einmal beim Mount

  function getMousePos(e: MouseEvent): Point {
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; // Prozentsatz: Wie viel von dem SVG hab ich "durchquert"
    const y = (e.clientY - rect.top) / rect.height;

    return new Point(
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
      const snapped = snapEnabled ? snapPoint(pos, snapPointsRef.current) : pos;
      
      setDraftWall(new Wall(null, new Point(snapped.x, snapped.y), new Point(snapped.x, snapped.y), selectedFloorId));
    } 
    else if (tool == "room") {
      const pos = getMousePos(e);
      const snapped = snapEnabled ? snapPoint(pos, snapPointsRef.current) : pos;

      setDraftRoom(new Room(null, new Point(snapped.x, snapped.y), new Point(snapped.x, snapped.y), selectedFloorId));
    }
  }

  function getDefaultContextMenuItems() {
    return [
      { label: "Clear Walls", onClick: () => setWalls([]) },
      { label: "Export JSON", onClick: () => alert(JSON.stringify({ floors, walls, rooms }, null, 2)) }
    ];
  }

  function deleteWall(id: number) {
    setWalls(prev => prev.filter(w => w.id !== id));
  }

  function deleteRoom(id: number) {
    setRooms(prev => prev.filter(r => r.id !== id));
  }

  function addFloor() {
    const nextFloorId = Date.now();
    setFloors(prev => [...prev, { id: nextFloorId, label: `Floor ${prev.length + 1}` }]);
    setSelectedFloorId(nextFloorId);
    setSelectedMovable(null);
  }

  function deleteFloor(id: number){
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

  /**
   * Just activates a input-Field to edit.
   * @param id The floor to rename
   */
  function renameFloor(id: number){
    
  }

  function handleWallContextMenu(e: MouseEvent, id: number) {
    e.preventDefault();
    contextMenuModeRef.current = 'wall';
    setContextMenuItems([
      { label: "Delete", onClick: () => deleteWall(id) },
      ...getDefaultContextMenuItems()
    ]);
  }

  function handleRoomContextMenu(e: MouseEvent, id: number) {
    e.preventDefault();
    contextMenuModeRef.current = 'room';
    setContextMenuItems([
      { label: "Delete", onClick: () => deleteRoom(id) },
      ...getDefaultContextMenuItems()
    ]);
  }

  function handleFloorContextMenu(e: MouseEvent, id: number) {
    e.preventDefault();
    contextMenuModeRef.current = 'floor';
    const lastFloor = floors.length <= 1;
    const additionalMenuItems = []
    if(!lastFloor){
      additionalMenuItems.push({ label: "Delete", onClick: () => deleteFloor(id) })
    }
    additionalMenuItems.push({ label: "Rename", onClick: () => setEditingFloorLabelId(id) })
    console.log(additionalMenuItems)
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
      const snapped = snapEnabled ? snapPoint(pos, snapPointsRef.current) : pos;

      setDraftWall(new Wall(draftWall.id, draftWall.p1, new Point(snapped.x, snapped.y), draftWall.floorId));
    } 
    else if (draftRoom){
      const pos = getMousePos(e);
      const snapped = snapEnabled ? snapPoint(pos, snapPointsRef.current) : pos;

      setDraftRoom(new Room(draftRoom.id, draftRoom.p1, new Point(snapped.x, snapped.y), draftRoom.floorId));
    }
  }

  function handleMouseUp() {
    if (draftWall){ 
      if(draftWall.p1.x === draftWall.p2.x && draftWall.p1.y === draftWall.p2.y) {
        setDraftWall(null);
        return; // Keine Mauern mit 0 Länge erlauben
      }

      const nextWall = draftWall.copyWith({id: Date.now(), floorId: selectedFloorId});
      setWalls(prev => [...prev, nextWall]);
      expandCanvasIfNeeded(nextWall.getSnappablePoints());
      setDraftWall(null);
    } 
    else if ( draftRoom) {
      if(draftRoom.p1.x === draftRoom.p2.x || draftRoom.p1.y === draftRoom.p2.y) {
        setDraftRoom(null);
        return; // Keine Räume mit 0 Fläche erlauben
      }

      const nextRoom = draftRoom.copyWith({id: Date.now(), floorId: selectedFloorId});
      setRooms(prev => [...prev, nextRoom]);
      expandCanvasIfNeeded(nextRoom.getSnappablePoints());
      setDraftRoom(null);
    }
  }

  function calculateSnapPoints(excluded: (Point | Wall)[] = []): Point[]{
    let points = []


    points = points.concat(visibleWalls.flatMap(wall => wall.getSnappablePoints()));
    points = points.concat(visibleRooms.flatMap(room => room.getSnappablePoints()));

    // visibleWalls.forEach(wall => {
    //   if(excluded.includes(wall)) return; // Ganze Wand ausgeschlossen -> beide Endpunkte ignorieren

    //   points = points.concat(wall.getSnappablePoints())
    // });

    points = points.filter(p =>
      !excluded.some(e => e instanceof Point && isSamePoint(e, p)) // Only non-excluded
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
  function moveDefiningPoint(movable: Movable, indexOfDefiningPoint: number, currentMouse: Point): Movable {
    if (!initialMousePos.current || !initialDefiningPointPos.current) return;
    const dx = currentMouse.x - initialMousePos.current.x;
    const dy = currentMouse.y - initialMousePos.current.y;
    const updatedPoint = updatePoint(initialDefiningPointPos.current, dx, dy);
    const updatedMovable = movable.copyWith({});
    updatedMovable.setDefiningPoints(updatedMovable.getDefiningPoints().map((point, index) => 
      index === indexOfDefiningPoint 
        ? updatedPoint 
        : point
    ))

    if (updatedPoint) {
      if (updatedMovable instanceof Wall && movable instanceof Wall) {
        setWalls(prev =>
          prev.map(w => {
            return w.id === movable.id ? updatedMovable : w;
          })
        );
        expandCanvasIfNeeded(updatedMovable.getSnappablePoints());
      } else if (updatedMovable instanceof Room) {
        setRooms(prev =>
          prev.map(r => (r.id === movable.id ? updatedMovable : r))
        );
        expandCanvasIfNeeded(updatedMovable.getSnappablePoints());
      }
      return updatedMovable;
    }
  }

  /**
   * @param movable movable To move.
   * @param currentMouse current mouse position. Used in par with initialMovablePos to calculate the delta.
   * @returns the updated movable.
   */
  function moveMovable(movable: Movable, currentMouse: Point): Movable {
    if (!initialMousePos.current || !initialMovablePos.current) return;
    const dx = currentMouse.x - initialMousePos.current.x;
    const dy = currentMouse.y - initialMousePos.current.y;
    const updated = updateMovable(initialMovablePos.current, dx, dy);
    if (updated) {
      if (updated instanceof Wall && movable instanceof Wall) {
        setWalls(prev =>
          prev.map(w => {
            return w.id === movable.id ? updated : w;
          })
        );
        expandCanvasIfNeeded(updated.getSnappablePoints());
      } else if (updated instanceof Room) {
        setRooms(prev =>
          prev.map(r => (r.id === movable.id ? updated : r))
        );
        expandCanvasIfNeeded(updated.getSnappablePoints());
      }
      return updated;
    }
  }

  function updatePoint(initialPoint: Point | null, dx: number, dy: number): Point | null {
    if(!initialPoint) return null;

    let movedPoint = initialPoint.copyWith({});

    movedPoint.x += dx;
    movedPoint.y += dy;

    if(!snapEnabled) return movedPoint;

    return snapPoint(movedPoint, snapPointsRef.current)
  }

  function updateMovable(initialMovable: Movable | null, dx: number, dy: number): Movable | null {
    if (!initialMovable) return null;
    let movedMovable = initialMovable.copyWith({});

    // Zuerst die Punkte einfach um die Verschiebung verschieben, bevor das Snapping berücksichtigt wird. 
    // So bleibt die relative Position der Punkte zueinander erhalten.
    let initialDefiningPoints = initialMovable.getDefiningPoints();
    let movedMovableDefiningPoints = movedMovable.getDefiningPoints();

    for(let i = 0; i < initialDefiningPoints.length; i++) {
      movedMovableDefiningPoints[i].x = initialDefiningPoints[i].x + dx;
      movedMovableDefiningPoints[i].y = initialDefiningPoints[i].y + dy;
    }

    if(!snapEnabled) return movedMovable;
    
    // # Snapping
    // ## Endpunkte extrahieren
    let snappingPoints = movedMovable.getSnappingPoints();
    let snappedPoints = []; // Array für gesnappte Punkte, oder die Punkte selbst, wenn sie nicht gesnapped wurden.

    snappingPoints.forEach(p => { // Versuch, jeden Punkt des zu bewegenden Elements zu snappen
      snappedPoints.push(snapPoint(p, snapPointsRef.current));
    });

    for (let index = 0; index < snappedPoints.length; index++) {
      const snappedPoint = snappedPoints[index];

      if (!isSamePoint(snappedPoint, snappingPoints[index])) { // Wenn dieser Punkt gesnapped ist -> Alle anderen Punkte genauso verschieben
        let snappingDeltaX = snappedPoint.x - snappingPoints[index].x;
        let snappingDeltaY = snappedPoint.y - snappingPoints[index].y;

        movedMovable.getDefiningPoints().forEach(p => {
          p.x += snappingDeltaX;
          p.y += snappingDeltaY;
        });

        break; // // Nur ein Punkt soll snappen, danach ist die Verschiebung für alle Punkte festgelegt
      }
    }

    return movedMovable;
  }

  function onMouseDownOnDefiningPoint(e: MouseEvent, movable: Movable, indexOfPoint: number) {
    if(tool !== "select") return;

    e.stopPropagation();

    initialMousePos.current = getMousePos(e);
    initialDefiningPointPos.current = movable.getDefiningPoints()[indexOfPoint].copyWith({}) // Just for calculation

    snapPointsRef.current = calculateSnapPoints(movable.getSnappablePoints());

    function onMove(event) {
      const currentMouse = getMousePos(event);
      const updatedMovable = moveDefiningPoint(movable, indexOfPoint, currentMouse)
      setSelectedMovable(updatedMovable) // Für updates der Defining-Points im UI
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      initialMousePos.current = null;
      initialMovablePos.current = null;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    // WIP
  }

  function onMouseDownOnMovable(e: MouseEvent, movable: Movable) {
    if(tool !== "select") return;

    e.stopPropagation();
    
    setSelectedMovable(movable);
    initialMousePos.current = getMousePos(e);
    initialMovablePos.current = movable.copyWith({}); // Kopie erstellen, damit die ursprüngliche Position für die Berechnung der Verschiebung erhalten bleibt

    snapPointsRef.current = calculateSnapPoints(movable.getSnappablePoints());

    function onMove(ev) {
      const currentMouse = getMousePos(ev);
      const updatedMovable = moveMovable(movable, currentMouse);
      setSelectedMovable(updatedMovable) // Für updates der Defining-Points im UI
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      initialMousePos.current = null;
      initialMovablePos.current = null;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }



  function changeRoomName(r: Room, value: string): void {
    setRooms(prev => 
      prev.map(room => room.id === r.id 
        ? room.copyWith({label: value}) 
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
              <div className="toolbar-floor">
                
              </div>
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
                {editingFloorLabelId == floor.id 
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
                    stroke={selectedMovable && selectedMovable.id === r.id ? "yellow" : "cyan"}
                    strokeWidth={selectedMovable && selectedMovable.id === r.id ? "4" : "2"}
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
                  stroke={selectedMovable && selectedMovable.id === w.id ? "yellow" : "white"}
                  strokeWidth={selectedMovable && selectedMovable.id === w.id ? "6" : "4"}
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
              {selectedMovable && selectedMovable.getDefiningPoints().map((point, index) => (
                <circle
                  key={`handle-${selectedMovable.id}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r="8"
                  fill="yellow"
                  stroke="black"
                  strokeWidth="1"
                  style={{ cursor: 'pointer' }}
                  onMouseDown={(e) => onMouseDownOnDefiningPoint(e, selectedMovable, index)}
                />
              ))}
            </svg>
          </div>
        </div>
      </ContextMenu>
    </>
  );
}

export default RoomEditor;