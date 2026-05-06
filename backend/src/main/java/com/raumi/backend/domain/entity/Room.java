package com.raumi.backend.domain.entity;

import com.raumi.backend.dto.PointDTO;
import com.raumi.backend.dto.RoomDTO;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
public class Room {
    @Id @Getter @Setter
    private UUID id;

    @ManyToOne @Getter @Setter
    @JoinColumn(name = "floor_id", nullable = false)
    private Floor floor;

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
        roomDTO.floorId = this.floor.getId();
        roomDTO.label = this.label;
        roomDTO.p1 = new PointDTO(p1_x, p1_y);
        roomDTO.p2 = new PointDTO(p2_x, p2_y);
        return roomDTO;
    }
}
