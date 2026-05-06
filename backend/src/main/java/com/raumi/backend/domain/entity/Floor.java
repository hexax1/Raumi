package com.raumi.backend.domain.entity;

import com.raumi.backend.dto.FloorDTO;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
public class Floor {
    @Id @Getter @Setter
    private UUID id;

    @Getter @Setter
    private String label;

    public FloorDTO toDTO(){
        FloorDTO floorDTO = new FloorDTO();
        floorDTO.id = this.id;
        floorDTO.label = this.label;
        return floorDTO;
    }
}
