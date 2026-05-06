import type { Room, Wall } from "../utils/geometry";
import { api } from "../utils/rest-api";

export type Floor = {
  id: string;
  label: string;
};

export type Layout = {
    floors: Floor[]
    rooms: Room[]
    walls: Wall[]
}

const API_MAPPING = "/api/roomLayout"

export function getLayout(): Promise<Layout>{
    return api.get<Layout>(API_MAPPING)
}

export function putLayout(layout: Layout): Promise<Layout>{
    return api.put(API_MAPPING, layout)
}