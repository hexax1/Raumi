CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE floor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT
);

CREATE TABLE room (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id      UUID NOT NULL,
  label         TEXT DEFAULT '',

  -- Upper-left corner
  p1_x          DOUBLE PRECISION NOT NULL,
  p1_y          DOUBLE PRECISION NOT NULL,

  -- Lower-right corner
  p2_x          DOUBLE PRECISION NOT NULL,
  p2_y          DOUBLE PRECISION NOT NULL,

  -- -- Constraints
  -- CHECK (p2_x >= p1_x),
  -- CHECK (p2_y >= p1_y),

  -- Foreign Key
  CONSTRAINT fk_rooms_floor
    FOREIGN KEY (floor_id)
    REFERENCES floors(id)
    ON DELETE CASCADE
);

CREATE TABLE wall (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id      UUID NOT NULL,

  -- Start point
  p1_x          DOUBLE PRECISION NOT NULL,
  p1_y          DOUBLE PRECISION NOT NULL,

  -- End point
  p2_x          DOUBLE PRECISION NOT NULL,
  p2_y          DOUBLE PRECISION NOT NULL,

  -- Foreign Key
  CONSTRAINT fk_walls_floor
    FOREIGN KEY (floor_id)
    REFERENCES floors(id)
    ON DELETE CASCADE
);