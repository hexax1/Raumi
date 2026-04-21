import { useState, useRef, type MouseEvent } from "react";
import { snapPoint, type Wall, type Point, isSamePoint, pointsAreClose } from "../utils/geometry";
import './RoomEditor.css'

export default function RoomEditor() {
  const [walls, setWalls] = useState<Wall[]>([]);
  const [tool, setTool] = useState("draw");
  const [draft, setDraft] = useState<Wall | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const snapPointsRef = useRef<Point[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);

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

  function calculateSnapPoints(excluded: Point[] = []): Point[]{
    let points = []

    walls.forEach(w => {
      points.push({ x: w.x1, y: w.y1 });
      points.push({ x: w.x2, y: w.y2 });
    });

    points = points.filter(p =>
      excluded.every(e => !pointsAreClose(e, p)) // Only non-excluded
    );
    console.log(`Points:`)
    console.log(points)
    console.log("Excluded:")
    console.log(excluded)

    return points
  }

  function moveWall(id: number, dx: number, dy: number) {
    setWalls(prev =>
      prev.map(w => (w.id === id ? updateWall(w, dx, dy) : w))
    );
  }

  function updateWall(w: Wall, dx: number, dy: number) {
    let movedWall = {
      ...w,
      x1: w.x1 + dx,
      y1: w.y1 + dy,
      x2: w.x2 + dx,
      y2: w.y2 + dy
    };

    if(!snapEnabled) return movedWall;
    
    // # Snapping
    // ## Exclude these points in snapping
    let wallP1 = {x: w.x1, y: w.y1};
    let wallP2 = {x: w.x2, y: w.y2};

    // ## Endpunkte extrahieren
    let movedP1 = {x: movedWall.x1, y: movedWall.y1};
    let movedP2 = {x: movedWall.x2, y: movedWall.y2};

    // ## Snappen
    let snappedP1 = snapPoint(movedP1, snapPointsRef.current)
    let snappedP2 = snapPoint(movedP2, snapPointsRef.current)
    if(isSamePoint(snappedP1, movedP1)) { // p1 snappt -> p2 genauso verschieben
      snappedP2.x = movedP2.x + snappedP1.x - movedP1.x
      snappedP2.y = movedP2.y + snappedP1.y - movedP1.y // Delta des Snappings: snapped - moved
    } else if(isSamePoint(snappedP2, movedP2)) {
      snappedP1.x = movedP1.x + snappedP2.x - movedP2.x
      snappedP1.y = movedP1.y + snappedP2.y - movedP2.y
    }

    movedWall.x1 = snappedP1.x; movedWall.y1 = snappedP1.y;
    movedWall.x2 = snappedP2.x; movedWall.y2 = snappedP2.y;

    return movedWall;
  }

  return (
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
            "linear-gradient(#1e3a5f 1px, transparent 1px), linear-gradient(90deg, #1e3a5f 1px, transparent 1px)",
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
            onMouseDown={(e) => {
              if(tool !== "select") return;

              e.stopPropagation();

              let last = getMousePos(e);

              snapPointsRef.current = calculateSnapPoints([
                { x: w.x1, y: w.y1 },
                { x: w.x2, y: w.y2 }
              ]);

              function onMove(ev) {
                const pos = getMousePos(ev);
                const dx = pos.x - last.x;
                const dy = pos.y - last.y;
                moveWall(w.id, dx, dy);
                last = pos;
              }

              function onUp() {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              }

              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
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
  );
}