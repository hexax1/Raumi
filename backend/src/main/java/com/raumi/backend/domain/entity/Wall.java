package com.raumi.backend.domain.entity;

import com.raumi.backend.dto.PointDTO;
import com.raumi.backend.dto.WallDTO;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
public class Wall {
    @Id
    private UUID id;

    @Getter
    private UUID floorId;

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
        wallDTO.floorId = this.floorId;
        wallDTO.p1 = new PointDTO(p1_x, p1_y);
        wallDTO.p2 = new PointDTO(p2_x, p2_y);
        return wallDTO;
    }
}
