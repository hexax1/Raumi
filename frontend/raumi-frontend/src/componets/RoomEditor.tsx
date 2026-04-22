import { useState, useRef, type MouseEvent } from "react";
import { Point, snapPoint, Wall, Room, isSamePoint, type Movable } from "../utils/geometry";
import './RoomEditor.css'
import ContextMenu from "./ContextMenu";

const RoomEditor: React.FC = () => {
  const [walls, setWalls] = useState<Wall[]>([]);
  const [draftWall, setDraftWall] = useState<Wall | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<number | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [draftRoom, setDraftRoom] = useState<Room | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  const [tool, setTool] = useState<"wall" | "room" | "select" | "zoom-in" | "zoom-out">("wall");
  const [zoom, setZoom] = useState(1);
  const [canvasBounds, setCanvasBounds] = useState({ minX: 0, minY: 0, width: 1600, height: 1200 });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [contextMenuItems, setContextMenuItems] = useState(getDefaultContextMenuItems);
  const contextMenuModeRef = useRef<'default' | 'wall' | 'room'>('default');

  const snapPointsRef = useRef<Point[]>([]); // Alle Punkte, an die gerade gesnapped werden kann. Wird bei jedem MouseDown neu berechnet.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const initialMousePos = useRef<Point | null>(null);
  const initialMovablePos = useRef<Movable | null>(null);

  const CANVAS_MARGIN = 200;
  const ZOOM_STEP = 1.2;
  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 3;

  function getMousePos(e: MouseEvent): Point {
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    return new Point(
      canvasBounds.minX + x * canvasBounds.width,
      canvasBounds.minY + y * canvasBounds.height
    );
  }

  function handleMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === "input") return; // Input-Elemente sollen kein Zeichnen auslösen können

    if (tool === "zoom-in" || tool === "zoom-out") {
      const nextZoom = tool === "zoom-in" ? Math.min(zoom * ZOOM_STEP, ZOOM_MAX) : Math.max(zoom / ZOOM_STEP, ZOOM_MIN);
      setZoom(nextZoom);
      return;
    }

    snapPointsRef.current = calculateSnapPoints();

    if (tool == "wall"){

      const pos = getMousePos(e);
      const snapped = snapEnabled ? snapPoint(pos, snapPointsRef.current) : pos;
      
      setDraftWall(new Wall(null, new Point(snapped.x, snapped.y), new Point(snapped.x, snapped.y)));
    } 
    else if (tool == "room") {
      const pos = getMousePos(e);
      const snapped = snapEnabled ? snapPoint(pos, snapPointsRef.current) : pos;

      setDraftRoom(new Room(null, new Point(snapped.x, snapped.y), new Point(snapped.x, snapped.y)));
    }
  }

  function getDefaultContextMenuItems() {
    return [
      { label: "Clear Walls", onClick: () => setWalls([]) },
      { label: "Export JSON", onClick: () => alert(JSON.stringify(walls, null, 2)) }
    ];
  }

  function deleteWall(id: number) {
    setWalls(prev => prev.filter(w => w.id !== id));
  }

  function deleteRoom(id: number) {
    setRooms(prev => prev.filter(r => r.id !== id));
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

  /**
   * Die Methode wird aufgerufen, wenn auf irgendwas im SVG rechtsgeklickt wird.
   * Gilt auch für Walls und Rooms. Deren Kontextmenüs werden aber zuerst aufgerufen wegen bubbling.
   */
  function handleEditorContextMenu() {
    if (contextMenuModeRef.current === 'wall' || contextMenuModeRef.current === 'room') {
      contextMenuModeRef.current = 'default';
      return;
    }

    setContextMenuItems(getDefaultContextMenuItems());
  }

  function handleMouseMove(e: MouseEvent) {
    if (draftWall){
      const pos = getMousePos(e);
      const snapped = snapEnabled ? snapPoint(pos, snapPointsRef.current) : pos;

      setDraftWall(new Wall(draftWall.id, draftWall.p1, new Point(snapped.x, snapped.y)));
    } 
    else if (draftRoom){
      const pos = getMousePos(e);
      const snapped = snapEnabled ? snapPoint(pos, snapPointsRef.current) : pos;

      setDraftRoom(new Room(draftRoom.id, draftRoom.p1, new Point(snapped.x, snapped.y)));
    }
  }

  function handleMouseUp() {
    if (draftWall){ 
      if(draftWall.p1.x === draftWall.p2.x && draftWall.p1.y === draftWall.p2.y) {
        setDraftWall(null);
        return; // Keine Mauern mit 0 Länge erlauben
      }

      const nextWall = draftWall.copyWith({id: Date.now()});
      setWalls(prev => [...prev, nextWall]);
      expandCanvasIfNeeded(nextWall.getSnappablePoints());
      setDraftWall(null);
    } 
    else if ( draftRoom) {
      if(draftRoom.p1.x === draftRoom.p2.x || draftRoom.p1.y === draftRoom.p2.y) {
        setDraftRoom(null);
        return; // Keine Räume mit 0 Fläche erlauben
      }

      const nextRoom = draftRoom.copyWith({id: Date.now()});
      setRooms(prev => [...prev, nextRoom]);
      expandCanvasIfNeeded(nextRoom.getSnappablePoints());
      setDraftRoom(null);
    }
  }

  function calculateSnapPoints(excluded: (Point | Wall)[] = []): Point[]{
    let points = []

    walls.forEach(w => {
      if(excluded.includes(w)) return; // Ganze Wand ausgeschlossen -> beide Endpunkte ignorieren
      
      points.push(new Point(w.p1.x, w.p1.y));
      points.push(new Point(w.p2.x, w.p2.y));
    });

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

  function moveMovable(movable: Movable, currentMouse: Point) {
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
    }
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
    // let movedP1 = {x: movedWall.p1.x, y: movedWall.p1.y};
    // let movedP2 = {x: movedWall.p2.x, y: movedWall.p2.y};

    // ## Snappen
    // let snappedP1 = snapPoint(movedP1, snapPointsRef.current)
    // let snappedP2 = snapPoint(movedP2, snapPointsRef.current)
    let snappedPoints = []; // Array für gesnappte Punkte, oder die Punkte selbst, wenn sie nicht gesnapped wurden.

    snappingPoints.forEach(p => { // Versuch, jeden Punkt des zu bewegenden Elements zu snappen
      snappedPoints.push(snapPoint(p, snapPointsRef.current));
    });

    for (let index = 0; index < snappedPoints.length; index++) {
      const snappedP = snappedPoints[index];

      if (!isSamePoint(snappedP, snappingPoints[index])) { // Wenn dieser Punkt gesnapped ist -> Alle anderen Punkte genauso verschieben
        let snappingDeltaX = snappedP.x - snappingPoints[index].x;
        let snappingDeltaY = snappedP.y - snappingPoints[index].y;

        movedMovable.getDefiningPoints().forEach(p => {
          p.x += snappingDeltaX;
          p.y += snappingDeltaY;
        });

        break; // // Nur ein Punkt soll snappen, danach ist die Verschiebung für alle Punkte festgelegt
      }
    }

    return movedMovable;
  }

  function onMouseDownOnMovable(e: MouseEvent, movable: Movable) {
    if(tool !== "select") return;

    e.stopPropagation();
    
    initialMousePos.current = getMousePos(e);
    initialMovablePos.current = movable.copyWith({}); // Kopie erstellen, damit die ursprüngliche Position für die Berechnung der Verschiebung erhalten bleibt

    snapPointsRef.current = calculateSnapPoints(movable.getSnappablePoints());

    function onMove(ev) {
      const currentMouse = getMousePos(ev);
      moveMovable(movable, currentMouse);
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



  return (
    <>
      <ContextMenu
        items={contextMenuItems}
        onContextMenu={handleEditorContextMenu}
      >
        <div className="editor-container">
          <div className="div-tool-buttons">
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
          </div>

          <button className="button-snap" onClick={() => setSnapEnabled(!snapEnabled)}>
            Snap: {snapEnabled ? "ON" : "OFF"}
          </button>

          <button className="button-zoom-level" onClick={() => null}>
            Zoom: {Math.round(zoom * 100)}%
          </button>

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
            {/* bestehende Wände */}
            {walls.map(w => (
              <line
                key={w.id}
                x1={w.p1.x}
                y1={w.p1.y}
                x2={w.p2.x}
                y2={w.p2.y}
                stroke="white"
                strokeWidth="4"
                onMouseDown={(e) => onMouseDownOnMovable(e, w)}
                onContextMenu={(e) => handleWallContextMenu(e, w.id)}
              />
            ))}

            {/* Vorschau */}
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

            {/* Bestehende Räume*/}
            {rooms.map(r => (
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
                  stroke="cyan"
                  strokeWidth="2"
                />
                <foreignObject
                  x={Math.min(r.p1.x, r.p2.x)}
                  y={Math.min(r.p1.y, r.p2.y)}
                  width={Math.abs(r.p2.x - r.p1.x)}
                  height={Math.abs(r.p2.y - r.p1.y)}
                >
                  <div style={{width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center"}}>
                    <input style={{width: "auto"}} 
                    value={r.label}
                    type="text" 
                    placeholder="Raumname" 
                    className="room-name-input"/>
                  </div>
                </foreignObject> 
              </g>
            ))}

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
          </svg>
        </div>
      </ContextMenu>
    </>
  );
}

export default RoomEditor;