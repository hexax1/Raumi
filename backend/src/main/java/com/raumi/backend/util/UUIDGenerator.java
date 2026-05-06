package com.raumi.backend.util;
import java.util.UUID;

public class UUIDGenerator {
    public static UUID getRandomUUID() {
        return UUID.randomUUID();
    }

    public static String getRandomUUIDString() {
        return UUID.randomUUID().toString();
    }
}
