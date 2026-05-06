package com.raumi.backend.service;

import com.raumi.backend.dto.FloorDTO;
import com.raumi.backend.dto.LayoutDTO;
import com.raumi.backend.dto.RoomDTO;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class RoomLayoutService {
    public RoomDTO createRoom(RoomDTO room) {
        return room;
    }

    /**
     * Das RoomLayout, das vom Client kommt, soll mit der Datenbank abgeglichen werden.
     * Zuerst werden in der Datenbank vorhandene Objekte upgedatet. Dann werden fehlende erstellt.
     * Zuletzt werden überflüssige entfernt.
     */
    public LayoutDTO putLayout(LayoutDTO layout) {
        layout.floors.add(new FloorDTO(UUID.randomUUID(), "HAHA"));
        System.out.println(layout);
        return layout;
    }
}
