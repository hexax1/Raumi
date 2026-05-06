package com.raumi.backend.repository;

import com.raumi.backend.domain.entity.Floor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface FloorRepository extends JpaRepository<Floor, UUID> {}
