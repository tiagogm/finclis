import { wiseGet, getProfileId } from "../client.js";
import { prompt } from "../auth.js";
import { parseMonth, monthBounds } from "../validate.js";

const ANSI: Record<string, string> = {
  strong: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
};
const RESET = "\x1b[0m";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatTitle(title: string, isTTY: boolean): string {
  if (isTTY) {
    return title.replace(/<(strong|green|red)>(.*?)<\/\1>/g, (_match, tag, content) => {
      return `${ANSI[tag]}${content}${RESET}`;
    });
  }
  return title.replace(/<\/?(strong|green|red)>/g, "");
}

export function monthLabel(month: number, year: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}
