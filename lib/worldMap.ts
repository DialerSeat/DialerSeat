// =============================================================================
// A PAPER MAP OF THE WORLD, IN LATITUDE AND LONGITUDE
// =============================================================================
// Everything here is stored in real coordinates and projected at draw time, so
// the coastline and the pings go through the SAME function. Anything else and
// the two drift apart the moment the projection changes — a ping sitting in
// the sea is the one bug this file exists to make impossible.
//
// EQUIRECTANGULAR on purpose. It is the flat schoolroom map: longitude maps
// straight to x, latitude straight to y, no trigonometry anywhere. It
// stretches badly near the poles, which is the accepted cost — nobody dials
// from Svalbard, and the alternative was a globe, which hides half the world
// at any moment and cannot be scanned at a glance.
//
// The coastlines are DELIBERATELY LOW-POLY. They are drawn from approximate
// coordinates and are not survey data: recognisable at a glance, honest about
// being a diagram. Fjords, small islands and exact borders are absent. This is
// a map for answering "is anybody dialing in Florida", not for navigation.
// =============================================================================

export type LatLon = readonly [number, number] // [lat, lon]

/** Equirectangular. lon -180..180 -> 0..width, lat 90..-90 -> 0..height. */
export function project(lat: number, lon: number, width: number, height: number) {
  return {
    x: ((lon + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  }
}

/** The map's natural aspect: 360 degrees wide by 180 tall. */
export const MAP_W = 720
export const MAP_H = 360

// ── COASTLINES ───────────────────────────────────────────────────────────
// Each entry is a closed ring of [lat, lon]. Traced roughly clockwise.
export const LAND: ReadonlyArray<{ name: string; ring: LatLon[] }> = [
  {
    name: 'North America',
    ring: [
      [71, -156], [70, -143], [69, -131], [68, -114], [69, -101], [67, -95],
      [69, -85], [73, -80], [76, -71], [70, -68], [63, -78], [58, -68],
      [60, -64], [55, -60], [51, -56], [47, -53], [45, -60], [45, -67],
      [41, -70], [39, -74], [35, -76], [31, -81], [25, -80], [26, -82],
      [30, -84], [29, -89], [28, -94], [26, -97], [21, -97], [18, -94],
      [21, -87], [18, -88], [16, -88], [13, -83], [9, -80], [8, -78],
      [10, -85], [15, -92], [16, -95], [20, -105], [23, -110], [27, -114],
      [31, -117], [34, -120], [40, -124], [46, -124], [49, -125], [55, -130],
      [59, -139], [60, -145], [61, -150], [58, -155], [55, -162], [59, -162],
      [62, -166], [65, -167], [68, -166], [71, -156],
    ],
  },
  {
    name: 'Greenland',
    ring: [
      [83, -33], [81, -19], [77, -18], [72, -22], [69, -24], [66, -35],
      [61, -43], [65, -52], [69, -51], [73, -56], [76, -60], [79, -66],
      [82, -60], [83, -45], [83, -33],
    ],
  },
  {
    name: 'Caribbean',
    ring: [
      [23, -81], [22, -78], [20, -74], [19, -70], [18, -68], [18, -72],
      [20, -77], [22, -84], [23, -81],
    ],
  },
  {
    // Drawn because they are US entries a real user could appear in, not for
    // completeness — every other island this size is deliberately absent.
    name: 'Hawaii',
    ring: [
      [22.3, -159.9], [21.4, -157.7], [21.1, -156.2], [19.1, -154.7],
      [18.8, -155.9], [20.6, -157.4], [21.6, -159.4], [22.3, -159.9],
    ],
  },
  {
    name: 'Puerto Rico',
    ring: [
      [18.55, -67.3], [18.55, -65.5], [17.9, -65.5], [17.9, -67.3], [18.55, -67.3],
    ],
  },
  {
    name: 'Jamaica',
    ring: [
      [18.6, -78.4], [18.6, -76.2], [17.7, -76.2], [17.7, -78.4], [18.6, -78.4],
    ],
  },
  {
    name: 'South America',
    ring: [
      [12, -72], [11, -64], [8, -60], [5, -52], [0, -50], [-5, -36],
      [-10, -36], [-16, -39], [-23, -42], [-27, -48], [-34, -53], [-38, -57],
      [-42, -63], [-48, -66], [-53, -68], [-55, -67], [-52, -72], [-46, -74],
      [-40, -73], [-33, -72], [-24, -70], [-18, -70], [-14, -76], [-6, -81],
      [-2, -80], [2, -78], [7, -77], [9, -75], [12, -72],
    ],
  },
  {
    name: 'Africa',
    ring: [
      [37, -6], [35, 0], [37, 10], [33, 12], [31, 19], [31, 25], [31, 32],
      [24, 35], [15, 40], [12, 43], [11, 51], [4, 47], [-2, 41], [-8, 39],
      [-15, 40], [-21, 35], [-26, 33], [-34, 26], [-34, 19], [-29, 17],
      [-23, 14], [-17, 12], [-9, 13], [-5, 12], [0, 9], [4, 9], [6, 3],
      [5, -4], [8, -13], [11, -16], [15, -17], [21, -17], [28, -13],
      [33, -9], [37, -6],
    ],
  },
  {
    // Norway, Sweden and Finland as one mass. The Gulf of Bothnia is drawn as
    // land, which is wrong and deliberate: at this scale the alternative is a
    // ragged sliver that reads as noise, and both Swedish and Finnish pings
    // have to land somewhere solid.
    name: 'Scandinavia',
    ring: [
      [71, 26], [70, 31], [68, 30], [66, 30], [64, 31], [62, 31], [61, 29],
      [60, 27], [60, 22], [59, 18], [58, 17], [56, 16], [55, 13], [57, 12],
      [58, 8], [59, 5], [62, 5], [65, 12], [68, 15], [70, 20], [71, 26],
    ],
  },
  {
    name: 'Denmark',
    ring: [
      [57.7, 10.5], [57, 11], [56, 11], [55, 10], [54.6, 9], [55, 8],
      [56, 8], [57.5, 9], [57.7, 10.5],
    ],
  },
  {
    name: 'Europe',
    ring: [
      [43, -9], [37, -9], [36, -6], [37, -2], [39, 0], [41, 3], [43, 7],
      [44, 9], [41, 13], [38, 16], [40, 18], [42, 19], [40, 20], [38, 23],
      [41, 26], [45, 29], [46, 31], [46, 37], [48, 40], [52, 40], [55, 35],
      [56, 28], [55, 22], [54, 19], [54, 14], [53.5, 7], [52.5, 4.3], [51.5, 3.4], [50, 1],
      [48, -2], [46, -1], [43, -2], [43, -9],
    ],
  },
  {
    name: 'Britain',
    ring: [
      [58, -5], [57, -2], [55, -1], [53, 0], [51, 1], [50, -4], [52, -5],
      [55, -5], [56, -6], [58, -5],
    ],
  },
  {
    name: 'Ireland',
    ring: [
      [55, -8], [54, -6], [52, -6], [51, -9], [53, -10], [55, -8],
    ],
  },
  {
    name: 'Asia',
    ring: [
      [66, 30], [69, 33], [72, 55], [74, 70], [76, 90], [73, 110], [72, 130],
      [69, 141], [62, 163], [60, 170], [64, 178], [59, 163], [55, 156],
      [51, 157], [46, 143], [43, 132], [41, 130], [39, 128], [37, 129],
      [35, 129], [34, 127], [37, 126], [39, 125], [38, 121], [35, 120],
      [32, 121], [30, 122], [24, 118], [21, 110], [21, 108], [18, 106],
      [16, 108], [12, 109], [10, 107], [9, 105], [10, 104], [8, 103],
      [6, 102.5], [4, 103.5], [1.5, 104.2], [1.15, 103.6], [2, 101.5], [5, 100.5],
      [7, 100], [8, 98], [12, 99], [16, 94],
      [21, 92], [22, 89], [24, 67], [25, 62], [26, 57], [27, 52], [25, 52],
      [24, 54], [22, 59], [17, 55], [13, 48], [12, 44], [16, 42], [21, 39],
      [25, 37], [28, 35], [30, 34], [31, 34], [36, 36], [41, 29], [45, 37],
      [47, 51], [42, 51], [45, 61], [50, 61], [55, 62], [58, 55], [56, 50],
      [58, 40], [66, 30],
    ],
  },
  {
    name: 'India',
    ring: [
      [24, 68], [23, 72], [19, 73], [15, 74], [10, 76], [8, 77], [10, 80],
      [16, 81], [20, 86], [22, 89], [26, 88], [28, 80], [30, 78], [32, 75],
      [29, 71], [24, 68],
    ],
  },
  {
    name: 'Japan',
    ring: [
      [45, 142], [43, 145], [41, 141], [38, 141], [35, 140], [34, 136],
      [33, 132], [31, 130], [34, 131], [36, 136], [39, 140], [41, 140],
      [43, 141], [45, 142],
    ],
  },
  {
    name: 'Philippines',
    ring: [
      [19, 121], [18, 122], [16, 122.5], [14, 123], [13, 124], [11, 125],
      [9, 126], [6, 126], [5, 125], [7, 122], [9, 122], [11, 122],
      [13, 121], [15, 120], [17, 120], [19, 121],
    ],
  },
  {
    name: 'Indonesia',
    ring: [
      [5, 95], [2, 100], [-3, 104], [-6, 106], [-8, 114], [-9, 122],
      [-8, 130], [-4, 136], [-1, 131], [1, 125], [4, 118], [7, 117],
      [3, 110], [1, 104], [5, 95],
    ],
  },
  {
    name: 'Australia',
    ring: [
      [-11, 132], [-12, 137], [-16, 141], [-11, 143], [-15, 145], [-20, 149],
      [-25, 153], [-31, 153], [-37, 150], [-38, 145], [-38, 141], [-35, 136],
      [-32, 134], [-33, 124], [-34, 118], [-32, 116], [-26, 113], [-22, 114],
      [-20, 119], [-16, 123], [-14, 127], [-11, 130], [-11, 132],
    ],
  },
  {
    name: 'New Zealand',
    ring: [
      [-35, 173], [-37, 175], [-39, 177], [-41, 175], [-42, 173], [-44, 171],
      [-46, 168], [-45, 167], [-42, 171], [-40, 172], [-37, 174], [-35, 173],
    ],
  },
  {
    name: 'Iceland',
    ring: [
      [66.5, -23], [66.2, -18], [66.5, -15], [65, -13.6], [63.5, -18],
      [63.8, -21.5], [64.9, -24], [66.5, -23],
    ],
  },
  {
    name: 'Cuba',
    ring: [
      [23.2, -84.9], [23.2, -81.2], [22.4, -78.5], [21.6, -77.2], [20.7, -74.2],
      [20.2, -74.1], [20.4, -77.2], [21.6, -79.5], [22.1, -81.5], [22.4, -84.5],
      [23.2, -84.9],
    ],
  },
  {
    name: 'Hispaniola',
    ring: [
      [19.9, -71.7], [19.8, -69.9], [19.3, -68.7], [18.4, -68.4], [18.2, -70.6],
      [18.3, -71.7], [18.0, -73.4], [18.2, -74.4], [19.0, -72.8], [19.9, -71.7],
    ],
  },
  {
    name: 'Sri Lanka',
    ring: [
      [9.8, 80.1], [8.6, 81.3], [7.0, 81.9], [6.0, 81.2], [5.9, 80.2],
      [7.5, 79.7], [9.1, 79.8], [9.8, 80.1],
    ],
  },
  {
    name: 'Taiwan',
    ring: [
      [25.3, 121.5], [24.5, 122.0], [23.0, 121.4], [22.0, 120.8],
      [23.1, 120.1], [24.7, 120.7], [25.3, 121.5],
    ],
  },
  {
    name: 'Papua New Guinea',
    ring: [
      [-2.6, 141], [-3.5, 144], [-5.5, 146], [-8.0, 147], [-10.7, 150.8],
      [-9.5, 149], [-8.5, 146], [-9.0, 143], [-8.0, 141], [-6.0, 141],
      [-2.6, 141],
    ],
  },
  {
    name: 'Madagascar',
    ring: [
      [-12.0, 49.3], [-15.5, 50.5], [-18.0, 49.4], [-21.5, 48.5], [-25.5, 47.0],
      [-25.1, 45.2], [-22.0, 43.3], [-18.0, 44.0], [-15.0, 45.8], [-12.4, 47.8],
      [-12.0, 49.3],
    ],
  },
  {
    name: 'Tasmania',
    ring: [
      [-40.7, 144.7], [-40.8, 148.3], [-42.5, 148.3], [-43.5, 146.9],
      [-43.0, 145.5], [-41.5, 144.6], [-40.7, 144.7],
    ],
  },
  {
    name: 'Sicily',
    ring: [
      [38.2, 12.4], [38.0, 15.6], [37.0, 15.3], [36.7, 15.1], [37.1, 12.5],
      [38.2, 12.4],
    ],
  },
  {
    name: 'Newfoundland',
    ring: [
      [51.6, -55.5], [51.4, -55.4], [49.7, -53.5], [47.6, -52.6], [46.7, -53.1],
      [47.4, -54.2], [47.6, -56.0], [48.5, -58.8], [50.7, -57.3], [51.6, -55.5],
    ],
  },
]


// ── INTERNAL BORDERS ─────────────────────────────────────────────────────
// Open polylines, not rings: a border is a line between two places, and
// closing it would fill a country that the coastline already drew.
//
// INDICATIVE, and more so than the coastlines. These are the divisions that
// make a dark map legible at a glance — you find Texas by the line above it,
// not by reading a label — and they are traced to a few degrees. They are not
// a statement about any disputed boundary and nothing in the product reads
// them; they are ink.
//
// Drawn under the pings and over the land fill, in a stroke a shade lighter
// than the coast so the outline of a continent still reads as the strongest
// line on the map.
export const BORDERS: ReadonlyArray<LatLon[]> = [
  // US / Canada — the 49th, the lakes, and the eastern run
  [[49, -123], [49, -95], [48.5, -94], [46.5, -84], [45.5, -82], [43, -79],
   [44.5, -76], [45, -71], [47, -68], [47.2, -67.8]],
  // US / Mexico
  [[32.5, -117], [31.3, -111], [31.3, -108], [31.8, -106.5], [29.8, -104],
   [29.3, -101], [26.5, -99], [25.9, -97.1]],
  // Mexico / Guatemala + Belize
  [[17.8, -92.2], [17.8, -89.1], [15.9, -88.9]],
  // Panama / Colombia
  [[9, -77.4], [7.9, -77.3]],
  // Brazil, western and southern
  [[4.5, -60.5], [1, -69.5], [-4, -70], [-9, -73], [-11, -68.5], [-16, -60],
   [-20, -58], [-22, -57.6], [-27, -55], [-30, -57], [-33.7, -53.4]],
  // Argentina / Chile — the Andes
  [[-22, -67], [-27, -69], [-33, -70.1], [-39, -71.5], [-46, -72], [-52, -72]],
  // Scandinavia's inner lines
  [[69, 20], [66, 15], [63, 12], [61, 12.5], [59, 11.5]],
  [[70, 28], [68, 23], [66, 24], [65, 24], [60, 27.5]],
  // France / Spain, France / Germany, Germany / Poland
  [[43.4, -1.8], [42.7, 0.7], [42.5, 3.2]],
  [[49, 8.2], [48, 7.6], [47.5, 7.6]],
  [[54, 14.3], [52, 14.6], [50.9, 15]],
  [[47, 12], [46.5, 13.7], [45.5, 13.6]],
  // Poland / Ukraine / Belarus
  [[52, 23.5], [50.5, 24], [48.5, 22.6]],
  // Russia / Kazakhstan
  [[51, 50], [51, 60], [53, 70], [50.5, 80], [49, 87]],
  // China / Mongolia / Russia
  [[49.5, 88], [50, 100], [49.5, 115], [45, 120], [42.5, 130]],
  // China / India — the Himalaya
  [[35, 76], [32, 79], [30, 81], [28, 88], [27.5, 92], [28.2, 97]],
  // India / Pakistan
  [[35, 74], [32, 75], [28, 70], [24, 68.8]],
  // India / Bangladesh / Myanmar
  [[26.5, 89], [23, 89], [22, 92], [25, 94.5], [27.5, 97]],
  // Thailand / Laos / Vietnam
  [[20.3, 100.4], [18, 103], [15, 105.5], [14, 107.5], [11.5, 106]],
  // Egypt / Sudan / Libya
  [[22, 25], [22, 36]],
  [[31, 25], [22, 25]],
  // Sahel: Algeria / Mali / Niger
  [[27, -8.7], [22, 0], [19, 4], [23, 12]],
  // Nigeria and the Gulf of Guinea states
  [[13.5, 4], [11, 3.6], [6.5, 2.7], [4.5, 8.5], [12, 14], [13.5, 14]],
  // DRC / Angola / Zambia
  [[-6, 12.3], [-8, 19], [-11, 22], [-13, 24], [-17.8, 25.3]],
  // South Africa / Namibia / Botswana / Zimbabwe
  [[-28.6, 16.5], [-25, 20], [-22, 29], [-22.3, 31.3]],
  // Australia is one country; these are the state lines that make it read
  [[-26, 129], [-26, 141], [-29, 141], [-29, 153]],
  [[-26, 138], [-38, 141]],
]

// ── WHERE A PING GOES ────────────────────────────────────────────────────
// Centroids, not capitals. A ping is a claim about a REGION, and putting it on
// the capital says something more precise than the data supports — Vercel's
// header gives a state or a country, never a street.
export const US_STATES: Record<string, { name: string; at: LatLon }> = {
  AL: { name: 'Alabama', at: [32.8, -86.8] },      AK: { name: 'Alaska', at: [64.0, -152.0] },
  AZ: { name: 'Arizona', at: [34.3, -111.7] },     AR: { name: 'Arkansas', at: [34.9, -92.4] },
  CA: { name: 'California', at: [37.2, -119.5] },  CO: { name: 'Colorado', at: [39.0, -105.5] },
  CT: { name: 'Connecticut', at: [41.6, -72.7] },  DE: { name: 'Delaware', at: [39.0, -75.5] },
  DC: { name: 'Washington DC', at: [38.9, -77.0] },FL: { name: 'Florida', at: [28.6, -82.4] },
  GA: { name: 'Georgia', at: [32.6, -83.4] },      HI: { name: 'Hawaii', at: [20.3, -156.4] },
  ID: { name: 'Idaho', at: [44.4, -114.6] },       IL: { name: 'Illinois', at: [40.0, -89.2] },
  IN: { name: 'Indiana', at: [39.9, -86.3] },      IA: { name: 'Iowa', at: [42.1, -93.5] },
  KS: { name: 'Kansas', at: [38.5, -98.4] },       KY: { name: 'Kentucky', at: [37.5, -85.3] },
  LA: { name: 'Louisiana', at: [31.1, -92.0] },    ME: { name: 'Maine', at: [45.4, -69.2] },
  MD: { name: 'Maryland', at: [39.0, -76.8] },     MA: { name: 'Massachusetts', at: [42.3, -71.8] },
  MI: { name: 'Michigan', at: [44.3, -85.4] },     MN: { name: 'Minnesota', at: [46.3, -94.3] },
  MS: { name: 'Mississippi', at: [32.7, -89.7] },  MO: { name: 'Missouri', at: [38.4, -92.5] },
  MT: { name: 'Montana', at: [47.0, -109.6] },     NE: { name: 'Nebraska', at: [41.5, -99.8] },
  NV: { name: 'Nevada', at: [39.3, -116.6] },      NH: { name: 'New Hampshire', at: [43.7, -71.6] },
  NJ: { name: 'New Jersey', at: [40.2, -74.7] },   NM: { name: 'New Mexico', at: [34.4, -106.1] },
  NY: { name: 'New York', at: [42.9, -75.5] },     NC: { name: 'North Carolina', at: [35.5, -79.4] },
  ND: { name: 'North Dakota', at: [47.4, -100.5] },OH: { name: 'Ohio', at: [40.3, -82.8] },
  OK: { name: 'Oklahoma', at: [35.6, -97.5] },     OR: { name: 'Oregon', at: [43.9, -120.6] },
  PA: { name: 'Pennsylvania', at: [40.9, -77.8] }, RI: { name: 'Rhode Island', at: [41.7, -71.6] },
  SC: { name: 'South Carolina', at: [33.9, -80.9] },SD: { name: 'South Dakota', at: [44.4, -100.2] },
  TN: { name: 'Tennessee', at: [35.8, -86.4] },    TX: { name: 'Texas', at: [31.5, -99.3] },
  UT: { name: 'Utah', at: [39.3, -111.7] },        VT: { name: 'Vermont', at: [44.1, -72.7] },
  VA: { name: 'Virginia', at: [37.5, -78.9] },     WA: { name: 'Washington', at: [47.4, -120.5] },
  WV: { name: 'West Virginia', at: [38.6, -80.6] },WI: { name: 'Wisconsin', at: [44.6, -89.7] },
  WY: { name: 'Wyoming', at: [43.0, -107.5] },     PR: { name: 'Puerto Rico', at: [18.2, -66.5] },
}

export const COUNTRIES: Record<string, { name: string; at: LatLon }> = {
  US: { name: 'United States', at: [39.5, -98.0] },  CA: { name: 'Canada', at: [56.1, -106.3] },
  MX: { name: 'Mexico', at: [23.6, -102.5] },        GB: { name: 'United Kingdom', at: [54.0, -2.0] },
  IE: { name: 'Ireland', at: [53.4, -8.2] },         FR: { name: 'France', at: [46.6, 2.2] },
  ES: { name: 'Spain', at: [40.2, -3.7] },           PT: { name: 'Portugal', at: [39.4, -8.2] },
  DE: { name: 'Germany', at: [51.2, 10.5] },         NL: { name: 'Netherlands', at: [52.1, 5.3] },
  BE: { name: 'Belgium', at: [50.5, 4.5] },          IT: { name: 'Italy', at: [41.9, 12.6] },
  CH: { name: 'Switzerland', at: [46.8, 8.2] },      AT: { name: 'Austria', at: [47.5, 14.6] },
  PL: { name: 'Poland', at: [51.9, 19.1] },          SE: { name: 'Sweden', at: [60.1, 18.6] },
  NO: { name: 'Norway', at: [60.5, 8.5] },           DK: { name: 'Denmark', at: [56.3, 9.5] },
  FI: { name: 'Finland', at: [61.9, 25.7] },         UA: { name: 'Ukraine', at: [48.4, 31.2] },
  RO: { name: 'Romania', at: [45.9, 25.0] },         GR: { name: 'Greece', at: [39.1, 21.8] },
  TR: { name: 'Turkey', at: [39.0, 35.2] },          RU: { name: 'Russia', at: [61.5, 90.0] },
  IN: { name: 'India', at: [22.0, 79.0] },           PK: { name: 'Pakistan', at: [30.4, 69.3] },
  BD: { name: 'Bangladesh', at: [23.7, 90.4] },      CN: { name: 'China', at: [35.9, 104.2] },
  JP: { name: 'Japan', at: [36.2, 138.3] },          KR: { name: 'South Korea', at: [35.9, 127.8] },
  PH: { name: 'Philippines', at: [12.9, 121.8] },    ID: { name: 'Indonesia', at: [-2.5, 118.0] },
  MY: { name: 'Malaysia', at: [4.2, 102.0] },        SG: { name: 'Singapore', at: [1.35, 103.8] },
  TH: { name: 'Thailand', at: [15.9, 101.0] },       VN: { name: 'Vietnam', at: [14.1, 108.3] },
  AU: { name: 'Australia', at: [-25.3, 133.8] },     NZ: { name: 'New Zealand', at: [-41.0, 174.0] },
  ZA: { name: 'South Africa', at: [-30.6, 22.9] },   NG: { name: 'Nigeria', at: [9.1, 8.7] },
  KE: { name: 'Kenya', at: [-0.0, 37.9] },           EG: { name: 'Egypt', at: [26.8, 30.8] },
  MA: { name: 'Morocco', at: [31.8, -7.1] },         AE: { name: 'UAE', at: [23.4, 53.8] },
  SA: { name: 'Saudi Arabia', at: [23.9, 45.1] },    IL: { name: 'Israel', at: [31.0, 34.9] },
  BR: { name: 'Brazil', at: [-14.2, -51.9] },        AR: { name: 'Argentina', at: [-38.4, -63.6] },
  CL: { name: 'Chile', at: [-35.7, -71.5] },         CO: { name: 'Colombia', at: [4.6, -74.3] },
  PE: { name: 'Peru', at: [-9.2, -75.0] },           DO: { name: 'Dominican Republic', at: [18.7, -70.2] },
  JM: { name: 'Jamaica', at: [18.1, -77.3] },        CR: { name: 'Costa Rica', at: [9.7, -83.8] },
}

/**
 * Where does this row belong on the map?
 *
 * A US state gets its own point — "somebody in America" is not a useful thing
 * to draw when the answer is really North Carolina. Anything else falls back
 * to the country, and anything we have no coordinates for returns null so the
 * caller can count it as unplaced rather than dropping it on the equator.
 */
export function locate(country: string | null, region: string | null) {
  if (country === 'US' && region && US_STATES[region]) {
    return { key: `US-${region}`, label: US_STATES[region].name, at: US_STATES[region].at, scope: 'state' as const }
  }
  if (country && COUNTRIES[country]) {
    return { key: country, label: COUNTRIES[country].name, at: COUNTRIES[country].at, scope: 'country' as const }
  }
  return null
}
