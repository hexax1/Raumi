package com.raumi.backend.dto;

import java.util.UUID;

public class RoomDTO {
    public UUID id;
    public UUID floorId;
    public String type;
    public String label;

    public PointDTO p1;
    public PointDTO p2;

    public RoomDTO(){}

    public RoomDTO(UUID id, UUID floorId, String label, PointDTO p1, PointDTO p2) {
        this.id = id;
        this.floorId = floorId;
        this.type = "room";
        this.label = label;
        this.p1 = p1;
        this.p2 = p2;
    }
}
