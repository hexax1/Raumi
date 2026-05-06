package com.raumi.backend.dto;


import java.util.UUID;

public class FloorDTO {
    public UUID id;
    public String label;

    public FloorDTO(UUID id, String name) {
        this.id = id;
        this.label = name;
    }

    public FloorDTO() {
    }
}
