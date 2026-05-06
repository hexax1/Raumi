package com.raumi.backend.service;

import com.raumi.backend.domain.entity.Floor;
import com.raumi.backend.domain.entity.Room;
import com.raumi.backend.domain.entity.Wall;
import com.raumi.backend.dto.FloorDTO;
import com.raumi.backend.dto.LayoutDTO;
import com.raumi.backend.dto.RoomDTO;
import com.raumi.backend.dto.WallDTO;
import com.raumi.backend.repository.FloorRepository;
import com.raumi.backend.repository.RoomRepository;
import com.raumi.backend.repository.WallRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomLayoutService {
    private final FloorRepository floorRepository;
    private final RoomRepository roomRepository;
    private final WallRepository wallRepository;

    public RoomDTO createRoom(RoomDTO room) {
        return room;
    }

    public LayoutDTO getLayout() {
        List<Floor> floors = floorRepository.findAll();
        List<Room> rooms = roomRepository.findAll();
        List<Wall> walls = wallRepository.findAll();

        LayoutDTO layoutDTO = new LayoutDTO();

        layoutDTO.floors = floors.stream().map(Floor::toDTO).toList();
        layoutDTO.rooms = rooms.stream().map(Room::toDTO).toList();
        layoutDTO.walls = walls.stream().map(Wall::toDTO).toList();

        return layoutDTO;
    }

    /**
     * Das RoomLayout, das vom Client kommt, soll mit der Datenbank abgeglichen werden.
     * Zuerst werden in der Datenbank vorhandene Objekte upgedatet. Dann werden fehlende erstellt.
     * Zuletzt werden überflüssige entfernt.
     */
    @Transactional
    public LayoutDTO putLayout(LayoutDTO layoutDTO) {

        Map<UUID, Floor> floorMap = new HashMap<>();
        // --------------------
        // 1. FLOORS
        // --------------------
        for (FloorDTO floorDTO : layoutDTO.floors) {
            Floor floor = floorRepository.findById(floorDTO.id)
                    .orElse(new Floor());

            floor.setId(floorDTO.id);
            floor.setLabel(floorDTO.label);

            floorMap.put(floor.getId(), floor);
        }

        floorRepository.saveAll(floorMap.values());

        // ---------------------
        // 2. ROOMS
        // ---------------------
        List<Room> rooms = new ArrayList<>();
        for(RoomDTO roomDTO : layoutDTO.rooms){
            Floor floor = floorMap.get(roomDTO.floorId);

            if(floor == null){
                throw new RuntimeException("Floor not found for room");
            }

            Room room = roomRepository.findById(roomDTO.id)
                    .orElse(new Room());

            room.setId(roomDTO.id);
            room.setLabel(roomDTO.label);
            room.setP1_x(roomDTO.p1.x);
            room.setP1_y(roomDTO.p1.y);
            room.setP2_x(roomDTO.p2.x);
            room.setP2_y(roomDTO.p2.y);
            room.setFloor(floor);

            rooms.add(room);
        }

        roomRepository.saveAll(rooms);

        // -------------------------
        // 3. WALLS
        // -------------------------
        List<Wall> walls = new ArrayList<>();

        for (WallDTO wallDTO : layoutDTO.walls) {
            Floor floor = floorMap.get(wallDTO.floorId);

            if (floor == null) {
                throw new RuntimeException("Floor not found for wall");
            }

            Wall wall = wallRepository.findById(wallDTO.id)
                    .orElse(new Wall());

            wall.setId(wallDTO.id);
            wall.setP1_x(wallDTO.p1.x);
            wall.setP1_y(wallDTO.p1.y);
            wall.setP2_x(wallDTO.p2.x);
            wall.setP2_y(wallDTO.p2.y);
            wall.setFloor(floor);

            walls.add(wall);
        }

        wallRepository.saveAll(walls);

        // -----------------------------
        // 4. DELETE
        // -----------------------------

        Set<UUID> floorIds = layoutDTO.floors.stream().map(f -> f.id).collect(Collectors.toSet());
        Set<UUID> roomIds = layoutDTO.rooms.stream().map(r -> r.id).collect(Collectors.toSet());
        Set<UUID> wallIds = layoutDTO.walls.stream().map(w -> w.id).collect(Collectors.toSet());

        roomRepository.deleteAll(
                roomRepository.findAll().stream()
                        .filter(r -> !roomIds.contains(r.getId()))
                        .toList()
        );

        wallRepository.deleteAll(
                wallRepository.findAll().stream()
                        .filter(w -> !wallIds.contains(w.getId()))
                        .toList()
        );

        floorRepository.deleteAll(
                floorRepository.findAll().stream()
                        .filter(f -> !floorIds.contains(f.getId()))
                        .toList()
        );

        return layoutDTO;
    }
}
