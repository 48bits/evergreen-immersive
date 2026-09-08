export type Vec3 = [number, number, number];
export interface StopConfig {
  id: string;
  chapter: string;
  origin: Vec3;
  camera: Vec3;
  target: Vec3;
  mobileCamera?: Vec3;
  mobileTarget?: Vec3;
  departureArc?: Vec3;
}
// World coordinates are shared by geometry, camera stops, and projected HTML headings.
export const stops: StopConfig[] = [
  {
    id: "top",
    chapter: "top",
    origin: [0, 0, 0],
    camera: [10, 10, 17],
    target: [-3.8, 2, 2.4],
    mobileCamera: [20, 20, 33],
    mobileTarget: [0, 7, 0],
    departureArc: [-2, 6, 7],
  },
  {
    id: "statement",
    chapter: "statement",
    origin: [22, 0, -8],
    camera: [12, 11, 18],
    target: [-3.8, 2, 2.4],
    departureArc: [5, 4, 5],
  },
  {
    id: "heritage",
    chapter: "heritage",
    origin: [42, 0, 2],
    camera: [7, 9, 19],
    target: [-4.5, 2, 1.5],
    departureArc: [-4, 5, 4],
  },
  {
    id: "funds",
    chapter: "activities",
    origin: [43, 0, -24],
    camera: [-12, 12, 18],
    target: [-3.8, 1, -2.4],
    departureArc: [-7, 4, 2],
  },
  {
    id: "direct",
    chapter: "activities",
    origin: [23, 0, -30],
    camera: [-15, 11, 16],
    target: [-3.2, 1, -3.2],
    departureArc: [3, 5, 7],
  },
  {
    id: "giving",
    chapter: "activities",
    origin: [0, 0, -27],
    camera: [12, 10, 18],
    target: [-3.8, 1.5, 2.4],
    departureArc: [-3, 5, 4],
  },
  {
    id: "events",
    chapter: "events",
    origin: [-21, 0, -17],
    camera: [8, 11, 19],
    target: [-3.8, 1.5, 2.4],
    departureArc: [0, 6, 1],
  },
  {
    id: "contact",
    chapter: "contact",
    origin: [0, 0, 0],
    camera: [47, 43, 62],
    target: [-3, 0, -8],
    mobileCamera: [67, 74, 92],
    mobileTarget: [13, -12, -16],
  },
];
export const chapterLabels: Record<string, string> = {
  top: "00 — Opening",
  statement: "01 — Statement",
  heritage: "02 — Heritage",
  activities: "03 — Activities",
  events: "04 — Events",
  contact: "05 — Contact",
};
export const motion = {
  desktop: {
    approach: 0.32,
    hold: 0.32,
    departure: 0.18,
    pixelRatio: 1.5,
    fps: 60,
  },
  mobile: {
    approach: 0.13,
    hold: 0.12,
    departure: 0.1,
    pixelRatio: 1.35,
    fps: 30,
  },
  pointerAmount: 0.18,
  headingTurn: 22,
  headingTravel: 85,
  mobileTravelScale: 0.22,
  fov: 39,
};
