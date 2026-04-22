import { useState, useRef, type MouseEvent } from "react";
import { Point, snapPoint, Wall, Room, isSamePoint, pointsAreClose } from "../utils/geometry";
import './RoomEditor.css'
import ContextMenu from "./ContextMenu";

const RoomEditor: React.FC = () => {
  const [walls, setWalls] = useState<Wall[]>([]);
  const [draftWall, setDraftWall] = useState<Wall | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<number | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [draftRoom, setDraftRoom] = useState<Room | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  const [tool, setTool] = useState("wall");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [contextMenuItems, setContextMenuItems] = useState(getDefaultContextMenuItems);
  const contextMenuModeRef = useRef<'default' | 'wall' | 'room'>('default');

  const snapPointsRef = useRef<Point[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const initialMousePos = useRef<Point | null>(null);
  const initialWallPos = useRef<Wall | null>(null);

  function getMousePos(e: MouseEvent) {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function handleMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === "input") return; // Input-Elemente sollen kein Zeichnen auslösen können

    snapPointsRef.current = calculateSnapPoints();

    if (tool == "wall"){

      const pos = getMousePos(e);
      const snapped = snapEnabled ? snapPoint(pos, snapPointsRef.current) : pos;
      
      setDraftWall({ id: null, x1: snapped.x, y1: snapped.y, x2: snapped.x, y2: snapped.y });
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
    setSelectedWallId(null);
  }

  function deleteRoom(id: number) {
    setRooms(prev => prev.filter(r => r.id !== id));
    setSelectedRoomId(null);
  }

  function handleWallContextMenu(e: MouseEvent, id: number) {
    e.preventDefault();
    contextMenuModeRef.current = 'wall';
    setSelectedWallId(id);
    setContextMenuItems([
      { label: "Delete", onClick: () => deleteWall(id) },
      ...getDefaultContextMenuItems()
    ]);
  }

  function handleRoomContextMenu(e: MouseEvent, id: number) {
    e.preventDefault();
    debugger;
    contextMenuModeRef.current = 'room';
    setSelectedRoomId(id);
    setContextMenuItems([
      { label: "Delete", onClick: () => deleteRoom(id) },
      ...getDefaultContextMenuItems()
    ]);
  }

  /**
   * Die Methode wird aufgerufen, wenn auf irgendwas im SVG rechtsgeklickt wird.
   * Gilt auch für Walls und Rooms. Deren Kontextmenüs werden aber zuerst aufgerufen wegen bubbling.
   */
  function handleEditorContextMenu(e: MouseEvent) { 
    if (contextMenuModeRef.current === 'wall' || contextMenuModeRef.current === 'room') {
      contextMenuModeRef.current = 'default';
      return;
    }

    setSelectedWallId(null);
    setContextMenuItems(getDefaultContextMenuItems());
  }

  function handleMouseMove(e: MouseEvent) {
    if (draftWall){
      const pos = getMousePos(e);
      const snapped = snapEnabled ? snapPoint(pos, snapPointsRef.current) : pos;

      setDraftWall({ ...draftWall, x2: snapped.x, y2: snapped.y });
    } 
    else if (draftRoom){
      const pos = getMousePos(e);
      const snapped = snapEnabled ? snapPoint(pos, snapPointsRef.current) : pos;

      setDraftRoom({ ...draftRoom, p2: new Point(snapped.x, snapped.y)})
    }
  }

  function handleMouseUp(e: MouseEvent) {
    if (draftWall){ 
      if(draftWall.x1 === draftWall.x2 || draftWall.y1 === draftWall.y2) {
        setDraftWall(null);
        return; // Keine Mauern mit 0 Fläche erlauben
      }

      setWalls([...walls, { ...draftWall, id: Date.now() }]);
      setDraftWall(null);
    } 
    else if ( draftRoom) {
      if(draftRoom.p1.x === draftRoom.p2.x || draftRoom.p1.y === draftRoom.p2.y) {
        setDraftRoom(null);
        return; // Keine Räume mit 0 Fläche erlauben
      }

      setRooms([...rooms, { ...draftRoom, id: Date.now() }]);
      setDraftRoom(null);
    }
  }

  function calculateSnapPoints(excluded: (Point | Wall)[] = []): Point[]{
    let points = []

    walls.forEach(w => {
      if(excluded.includes(w)) return; // Ganze Wand ausgeschlossen -> beide Endpunkte ignorieren
      
      points.push(new Point(w.x1, w.y1));
      points.push(new Point(w.x2, w.y2));
    });

    points = points.filter(p =>
      !excluded.some(e => e instanceof Point && isSamePoint(e, p)) // Only non-excluded
    );

    return points
  }

  function moveWall(id: number, currentMouse: Point) {
    if (!initialMousePos.current || !initialWallPos.current) return;
    const dx = currentMouse.x - initialMousePos.current.x;
    const dy = currentMouse.y - initialMousePos.current.y;
    const updated = updateWall(initialWallPos.current, dx, dy);
    if (updated) {
      setWalls(prev =>
        prev.map(w => (w.id === id ? updated : w))
      );
    }
  }

  function updateWall(initialWall: Wall | null, dx: number, dy: number): Wall | null {
    if (!initialWall) return null;
    let movedWall = {
      ...initialWall,
      x1: initialWall.x1 + dx,
      y1: initialWall.y1 + dy,
      x2: initialWall.x2 + dx,
      y2: initialWall.y2 + dy
    };

    if(!snapEnabled) return movedWall;
    
    // # Snapping
    // ## Endpunkte extrahieren
    let movedP1 = {x: movedWall.x1, y: movedWall.y1};
    let movedP2 = {x: movedWall.x2, y: movedWall.y2};

    // ## Snappen
    let snappedP1 = snapPoint(movedP1, snapPointsRef.current)
    let snappedP2 = snapPoint(movedP2, snapPointsRef.current)

    if(!isSamePoint(snappedP1, movedP1)) { // p1 snappt -> p2 genauso verschieben
      snappedP2.x = movedP2.x + snappedP1.x - movedP1.x
      snappedP2.y = movedP2.y + snappedP1.y - movedP1.y // Delta des Snappings: snapped - moved
    } else if(!isSamePoint(snappedP2, movedP2)) {
      snappedP1.x = movedP1.x + snappedP2.x - movedP2.x
      snappedP1.y = movedP1.y + snappedP2.y - movedP2.y
    }

    movedWall.x1 = snappedP1.x; movedWall.y1 = snappedP1.y;
    movedWall.x2 = snappedP2.x; movedWall.y2 = snappedP2.y;

    return movedWall;
  }

  function onMouseDownOnWall(e: MouseEvent, w: Wall) {
    if(tool !== "select") return;

    e.stopPropagation();

    const initialMouse = getMousePos(e);
    const wall = w;
    initialMousePos.current = initialMouse;
    initialWallPos.current = { ...wall };

    snapPointsRef.current = calculateSnapPoints([
      new Point(wall.x1, wall.y1),
      new Point(wall.x2, wall.y2)
    ]);

    function onMove(ev) {
      const currentMouse = getMousePos(ev);
      moveWall(w.id, currentMouse);
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      initialMousePos.current = null;
      initialWallPos.current = null;
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
          </div>

          <button className="button-snap" onClick={() => setSnapEnabled(!snapEnabled)}>
            Snap: {snapEnabled ? "ON" : "OFF"}
          </button>

          <svg
            ref={svgRef}
            width="800"
            height="600"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
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
                x1={w.x1}
                y1={w.y1}
                x2={w.x2}
                y2={w.y2}
                stroke="white"
                strokeWidth="4"
                onMouseDown={(e) => onMouseDownOnWall(e, w)}
                onContextMenu={(e) => handleWallContextMenu(e, w.id)}
              />
            ))}

            {/* Vorschau */}
            {draftWall && (
              <line
                x1={draftWall.x1}
                y1={draftWall.y1}
                x2={draftWall.x2}
                y2={draftWall.y2}
                stroke="cyan"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            )}

            {/* Bestehende Räume*/}
            {rooms.map(r => (<>
              <rect
                key={r.id}
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
                onContextMenu={(e) => handleRoomContextMenu(e, r.id)}
              >
                <div style={{width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center"}}>
                  <input style={{width: "auto"}} 
                  value={r.label}
                  type="text" 
                  placeholder="Raumname" 
                  className="room-name-input"/>
                </div>
              </foreignObject> </>
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