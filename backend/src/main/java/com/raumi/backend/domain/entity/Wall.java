package com.raumi.backend.domain.entity;

import com.raumi.backend.dto.PointDTO;
import com.raumi.backend.dto.WallDTO;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
public class Wall {
    @Id @Getter @Setter
    private UUID id;

    @ManyToOne @Getter @Setter
    @JoinColumn(name = "floor_id", nullable = false)
    private Floor floor;

    @Getter @Setter
    private double p1_x;
    @Getter @Setter
    private double p1_y;
    @Getter @Setter
    private double p2_x;
    @Getter @Setter
    private double p2_y;

    public WallDTO toDTO() {
        WallDTO wallDTO = new WallDTO();
        wallDTO.id = this.id;
        wallDTO.floorId = this.floor.getId();
        wallDTO.type = "wall";
        wallDTO.p1 = new PointDTO(p1_x, p1_y);
        wallDTO.p2 = new PointDTO(p2_x, p2_y);
        return wallDTO;
    }
}
