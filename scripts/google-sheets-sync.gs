const API_BASE_URL = "https://your-app.example.com";
const SYNC_ENDPOINT = "/api/sync/google-sheets";
const SYNC_SECRET = "replace-with-google-sheets-sync-secret";
const SHEET_NAME = "Sheet1";

const REQUIRED_HEADERS = [
  "Locator Number",
  "Airline",
  "Flight #",
  "Departure From",
  "Departure Date",
  "Dep Time",
  "Arrival at",
  "Arrival Date",
  "Arrival Time",
  "First Name",
  "Last Name",
  "Cost",
  "Drop off",
  "Pickup",
];

function syncWestSantoSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('Sheet "' + SHEET_NAME + '" was not found.');
  }

  const rows = readSheetRows_(sheet);
  const trips = groupRowsIntoTrips_(rows);
  const snapshot = {
    source: "google-sheets",
    syncedAt: new Date().toISOString(),
    sheetName: SHEET_NAME,
    trips: trips,
  };

  const response = postSnapshot_(snapshot);
  Logger.log("Google Sheets sync completed. Trips: " + trips.length + ", status: " + response.status);
  Logger.log(response.body);
}

function installHourlyTrigger() {
  const existingTriggers = ScriptApp.getProjectTriggers();
  existingTriggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "syncWestSantoSheet") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("syncWestSantoSheet").timeBased().everyHours(1).create();
}

function readSheetRows_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    return [];
  }

  const headers = values[0];
  const headerMap = normalizeHeaderMap_(headers);
  const rows = [];

  for (var index = 1; index < values.length; index += 1) {
    const row = values[index];
    if (row.join("").trim() === "") {
      continue;
    }

    rows.push(normalizeRow_(row, headerMap, index + 1));
  }

  return rows;
}

function normalizeHeaderMap_(headers) {
  const headerMap = {};
  headers.forEach(function (header, index) {
    headerMap[String(header).trim()] = index;
  });

  REQUIRED_HEADERS.forEach(function (header) {
    if (headerMap[header] === undefined) {
      throw new Error('Missing required header "' + header + '".');
    }
  });

  return headerMap;
}

function normalizeRow_(row, headerMap, sheetRowNumber) {
  const locatorNumber = normalizeText_(row[headerMap["Locator Number"]]);
  const airline = normalizeText_(row[headerMap["Airline"]]);
  const flightNumber = normalizeText_(row[headerMap["Flight #"]]).toUpperCase();
  const departureAirport = normalizeCode_(row[headerMap["Departure From"]]);
  const departureDate = normalizeDate_(row[headerMap["Departure Date"]]);
  const departureTime = normalizeTime_(row[headerMap["Dep Time"]]);
  const arrivalAirport = normalizeCode_(row[headerMap["Arrival at"]]);
  const arrivalDate = normalizeDate_(row[headerMap["Arrival Date"]]);
  const arrivalTime = normalizeTime_(row[headerMap["Arrival Time"]]);
  const firstName = normalizeText_(row[headerMap["First Name"]]);
  const lastName = normalizeText_(row[headerMap["Last Name"]]);
  const cost = normalizeText_(row[headerMap["Cost"]]) || null;
  const dropoffDriverName = normalizeText_(row[headerMap["Drop off"]]) || null;
  const pickupDriverName = normalizeText_(row[headerMap["Pickup"]]) || null;

  if (!airline || !flightNumber || !departureAirport || !departureDate || !departureTime || !arrivalAirport || !arrivalDate || !arrivalTime || !firstName || !lastName) {
    throw new Error("Row " + sheetRowNumber + " is missing required trip or passenger data.");
  }

  return {
    sheetRowNumber: sheetRowNumber,
    locatorNumber: locatorNumber || null,
    airline: airline,
    flightNumber: flightNumber,
    departureAirport: departureAirport,
    departureDate: departureDate,
    departureTime: departureTime,
    arrivalAirport: arrivalAirport,
    arrivalDate: arrivalDate,
    arrivalTime: arrivalTime,
    firstName: firstName,
    lastName: lastName,
    cost: cost,
    dropoffDriverName: dropoffDriverName,
    pickupDriverName: pickupDriverName,
  };
}

function buildTripKey_(row) {
  const identityParts = [
    row.airline,
    row.flightNumber,
    row.departureAirport,
    row.departureDate,
    row.departureTime,
    row.arrivalAirport,
    row.arrivalDate,
    row.arrivalTime,
  ];

  if (row.locatorNumber) {
    identityParts.unshift(row.locatorNumber);
  }

  return identityParts.join("|");
}

function groupRowsIntoTrips_(rows) {
  const tripMap = new Map();

  rows.forEach(function (row) {
    const key = buildTripKey_(row);
    if (!tripMap.has(key)) {
      tripMap.set(key, {
        externalKey: key,
        locatorNumber: row.locatorNumber,
        airline: row.airline,
        flightNumber: row.flightNumber,
        departureAirport: row.departureAirport,
        departureDate: row.departureDate,
        departureTime: row.departureTime,
        arrivalAirport: row.arrivalAirport,
        arrivalDate: row.arrivalDate,
        arrivalTime: row.arrivalTime,
        cost: row.cost,
        passengers: [],
        pickupDriverName: row.pickupDriverName,
        dropoffDriverName: row.dropoffDriverName,
        sourceRows: [],
      });
    }

    const trip = tripMap.get(key);
    const passengerKey = normalizeName_(row.firstName + " " + row.lastName);
    const existingPassenger = trip.passengers.some(function (passenger) {
      return normalizeName_(passenger.firstName + " " + passenger.lastName) === passengerKey;
    });

    if (!existingPassenger) {
      trip.passengers.push({
        firstName: row.firstName,
        lastName: row.lastName,
      });
    }

    if (!trip.cost && row.cost) {
      trip.cost = row.cost;
    }
    if (!trip.pickupDriverName && row.pickupDriverName) {
      trip.pickupDriverName = row.pickupDriverName;
    }
    if (!trip.dropoffDriverName && row.dropoffDriverName) {
      trip.dropoffDriverName = row.dropoffDriverName;
    }

    trip.sourceRows.push(row.sheetRowNumber);
  });

  return Array.from(tripMap.values());
}

function postSnapshot_(snapshot) {
  const response = UrlFetchApp.fetch(API_BASE_URL + SYNC_ENDPOINT, {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-sync-secret": SYNC_SECRET,
    },
    muteHttpExceptions: true,
    payload: JSON.stringify(snapshot),
  });

  const status = response.getResponseCode();
  const body = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error("Sync failed with status " + status + ": " + body);
  }

  return {
    status: status,
    body: body,
  };
}

function normalizeText_(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeCode_(value) {
  return normalizeText_(value).toUpperCase();
}

function normalizeName_(value) {
  return normalizeText_(value).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");
}

function normalizeDate_(value) {
  const text = normalizeText_(value);
  const parts = text.split("/");
  if (parts.length !== 3) {
    throw new Error('Unsupported date format "' + text + '". Expected M/D/YYYY.');
  }

  const month = String(Number(parts[0])).padStart(2, "0");
  const day = String(Number(parts[1])).padStart(2, "0");
  const year = String(Number(parts[2]));
  return year + "-" + month + "-" + day;
}

function normalizeTime_(value) {
  const text = normalizeText_(value).toLowerCase();
  const match = text.match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)$/);
  if (!match) {
    throw new Error('Unsupported time format "' + text + '". Expected h.mmam or h:mmpm.');
  }

  var hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = match[3];

  if (meridiem === "am" && hours === 12) {
    hours = 0;
  } else if (meridiem === "pm" && hours !== 12) {
    hours += 12;
  }

  return String(hours).padStart(2, "0") + ":" + minutes;
}
