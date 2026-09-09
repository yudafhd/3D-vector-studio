import type { IconType } from "../types";

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (Math.PI * i) / 5;
    const radius = i % 2 === 0 ? outer : inner;
    points.push(`${cx + Math.cos(angle) * radius} ${cy + Math.sin(angle) * radius}`);
  }
  return `M ${points.join(" L ")} Z`;
}

export function iconPath(icon: IconType): string | null {
  switch (icon) {
    case "none":
      return null;

    case "dollar":
      return [
        "M 480 155",
        "C 480 138 494 125 512 125",
        "C 530 125 544 138 544 155",
        "L 544 265",
        "L 480 265",
        "Z",
        "M 480 660",
        "L 544 660",
        "L 544 745",
        "C 544 762 530 775 512 775",
        "C 494 775 480 762 480 745",
        "Z",
        "M 585 330",
        "C 580 275 545 248 495 248",
        "C 428 248 375 292 375 360",
        "C 375 430 432 468 505 492",
        "C 575 515 625 548 625 618",
        "C 625 692 568 738 490 738",
        "C 425 738 382 698 372 642",
        "C 368 620 388 602 414 608",
        "C 426 612 434 624 438 640",
        "C 446 668 472 688 502 688",
        "C 538 688 564 665 564 625",
        "C 564 578 522 550 452 525",
        "C 382 498 322 455 322 365",
        "C 322 285 385 238 468 238",
        "C 475 238 482 239 488 240",
        "C 482 245 448 275 448 355",
        "C 448 382 468 402 495 402",
        "C 520 402 548 380 556 345",
        "C 560 326 578 316 595 328",
        "C 605 336 605 348 595 358",
        "Z"
      ].join(" ");

    case "check":
      return [
        "M 330 480",
        "L 430 580",
        "L 672 320",
        "L 738 382",
        "L 438 702",
        "L 264 528",
        "Z"
      ].join(" ");

    case "bolt":
      return [
        "M 532 190",
        "L 338 492",
        "L 471 492",
        "L 406 718",
        "L 680 408",
        "L 536 408",
        "L 618 190",
        "Z"
      ].join(" ");

    case "star":
      return starPath(500, 455, 235, 112);
  }
}
