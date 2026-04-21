import { useState, useRef, type MouseEvent } from "react";
import { Point, snapPoint, Wall, isSamePoint, pointsAreClose } from "../utils/geometry";
import './RoomEditor.css'
import ContextMenu from "./ContextMenu";

const RoomEditor: React.FC = () => {
  const [walls, setWalls] = useState<Wall[]>([]);
  const [tool, setTool] = useState("draw");
  const [draft, setDraft] = useState<Wall | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [selectedWallId, setSelectedWallId] = useState<number | null>(null);
  const [contextMenuItems, setContextMenuItems] = useState(getDefaultContextMenuItems);
  const contextMenuModeRef = useRef<'default' | 'line'>('default');

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
    if (tool == "draw"){

      const pos = getMousePos(e);
      const snapped = snapEnabled ? snapPoint(pos, calculateSnapPoints()) : pos;
      
      setDraft({ id: null, x1: snapped.x, y1: snapped.y, x2: snapped.x, y2: snapped.y });
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

  function handleLineContextMenu(e: MouseEvent, id: number) {
    e.preventDefault();
    contextMenuModeRef.current = 'line';
    setSelectedWallId(id);
    setContextMenuItems([
      { label: "Delete", onClick: () => deleteWall(id) },
      ...getDefaultContextMenuItems()
    ]);
  }

  function handleEditorContextMenu(e: MouseEvent) {
    if (contextMenuModeRef.current === 'line') {
      contextMenuModeRef.current = 'default';
      return;
    }

    setSelectedWallId(null);
    setContextMenuItems(getDefaultContextMenuItems());
  }

  function handleMouseMove(e: MouseEvent) {
    if (!draft) return;

    const pos = getMousePos(e);
    const snapped = snapEnabled ? snapPoint(pos, calculateSnapPoints()) : pos;

    setDraft({ ...draft, x2: snapped.x, y2: snapped.y });
  }

  function handleMouseUp(e: MouseEvent) {
    if (!draft) return;

    setWalls([...walls, { ...draft, id: Date.now() }]);
    setDraft(null);
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

  function onMouseDownOnLine(e: MouseEvent, w: Wall) {
    if(tool !== "select") return;

    e.stopPropagation();

    const initialMouse = getMousePos(e);
    const wall = w;
    initialMousePos.current = initialMouse;
    initialWallPos.current = { ...wall };

    snapPointsRef.current = calculateSnapPoints([
      { x: wall.x1, y: wall.y1 },
      { x: wall.x2, y: wall.y2 }
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
            <button className={`select-button ${tool == "draw" ? "active" : ""}`} onClick={() => setTool("draw")}>
              Draw
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
                onMouseDown={(e) => onMouseDownOnLine(e, w)}
                onContextMenu={(e) => handleLineContextMenu(e, w.id)}
              />
            ))}

            {/* Vorschau */}
            {draft && (
              <line
                x1={draft.x1}
                y1={draft.y1}
                x2={draft.x2}
                y2={draft.y2}
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