package com.raumi.backend.repository;

import com.raumi.backend.domain.entity.Wall;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface WallRepository extends JpaRepository<Wall, UUID> {}

