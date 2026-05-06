package com.raumi.backend.domain.entity;

import com.raumi.backend.dto.PointDTO;
import com.raumi.backend.dto.RoomDTO;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
public class Room {
    @Id
    private UUID id;

    @Getter
    private UUID floorId;

    @Getter @Setter
    private String label;

    @Getter @Setter
    private double p1_x;
    @Getter @Setter
    private double p1_y;
    @Getter @Setter
    private double p2_x;
    @Getter @Setter
    private double p2_y;

    public RoomDTO toDTO() {
        RoomDTO roomDTO = new RoomDTO();
        roomDTO.id = this.id;
        roomDTO.floorId = this.floorId;
        roomDTO.label = this.label;
        roomDTO.p1 = new PointDTO(p1_x, p1_y);
        roomDTO.p2 = new PointDTO(p2_x, p2_y);
        return roomDTO;
    }
}
