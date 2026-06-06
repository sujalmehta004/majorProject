/**
 * Converts a raw base unit count (tablets) into a human-readable Box, Strip, Tablet UOM string.
 * @param totalTablets Total quantity in raw base units
 * @param tabletsPerStrip Number of tablets in one strip (e.g. 10)
 * @param stripsPerBox Number of strips in one box (e.g. 10)
 */
export function uomToString(
  totalTablets: number,
  tabletsPerStrip: number,
  stripsPerBox: number
): string {
  if (totalTablets <= 0) return '0 Tablets';

  const tabletsPerBox = tabletsPerStrip * stripsPerBox;
  const boxes = Math.floor(totalTablets / tabletsPerBox);
  const remainderAfterBoxes = totalTablets % tabletsPerBox;
  const strips = Math.floor(remainderAfterBoxes / tabletsPerStrip);
  const tablets = remainderAfterBoxes % tabletsPerStrip;

  const parts = [];
  if (boxes > 0) {
    parts.push(`${boxes} Box${boxes > 1 ? 'es' : ''}`);
  }
  if (strips > 0) {
    parts.push(`${strips} Strip${strips > 1 ? 's' : ''}`);
  }
  if (tablets > 0) {
    parts.push(`${tablets} Tablet${tablets > 1 ? 's' : ''}`);
  }

  return parts.length > 0 ? parts.join(', ') : '0 Tablets';
}

/**
 * Converts Box, Strip, Tablet quantities into a raw base unit count.
 */
export function UOMToBaseUnits(
  boxes: number,
  strips: number,
  tablets: number,
  tabletsPerStrip: number,
  stripsPerBox: number
): number {
  const tabletsPerBox = tabletsPerStrip * stripsPerBox;
  return (boxes * tabletsPerBox) + (strips * tabletsPerStrip) + tablets;
}
