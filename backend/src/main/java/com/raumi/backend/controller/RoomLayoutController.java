package com.raumi.backend.controller;

import com.raumi.backend.dto.LayoutDTO;
import com.raumi.backend.dto.PointDTO;
import com.raumi.backend.dto.RoomDTO;
import com.raumi.backend.service.RoomLayoutService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/roomLayout")

public class RoomLayoutController {
    private final RoomLayoutService roomLayoutService;

    public RoomLayoutController(RoomLayoutService roomLayoutService){
        this.roomLayoutService = roomLayoutService;
    }

    // Nächstes: Wenn POST-Anfrage kommt, dann alles aus Datenbank auslesen und bearbeiten. Fehlendes neu erstellen.
    // Gesamtes zurückschicken.

    @GetMapping()
    public LayoutDTO getLayout() {
        return roomLayoutService.getLayout();
    }

    @PostMapping
    public RoomDTO createRoom(@RequestBody RoomDTO room){
        return roomLayoutService.createRoom(room);
    }

    @PutMapping
    public LayoutDTO putLayout(@RequestBody LayoutDTO layout){
        return roomLayoutService.putLayout(layout);
    }
}
