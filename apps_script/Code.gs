const SHEET_PRODUCTS = "Produtos";
const SHEET_MOVEMENTS = "Movimentacoes";

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const productsSheet = getSheet(spreadsheet, SHEET_PRODUCTS, [
    "id",
    "name",
    "supplier",
    "stock",
    "createdAt",
    "lastEntry",
    "lastExit",
  ]);
  const movementsSheet = getSheet(spreadsheet, SHEET_MOVEMENTS, [
    "id",
    "productId",
    "type",
    "quantity",
    "date",
  ]);

  if (payload.action === "list") {
    const products = readSheet(productsSheet);
    const movements = readSheet(movementsSheet).map((movement) => ({
      ...movement,
      quantity: Number(movement.quantity),
    }));
    return jsonResponse({ products, movements });
  }

  if (payload.action === "addProduct") {
    appendRow(productsSheet, payload.data);
    return jsonResponse({ success: true });
  }

  if (payload.action === "updateProduct") {
    updateRow(productsSheet, payload.data.id, payload.data);
    return jsonResponse({ success: true });
  }

  if (payload.action === "addMovement") {
    appendRow(movementsSheet, payload.data);
    updateStock(productsSheet, payload.data);
    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: "Ação desconhecida" }, 400);
}

function getSheet(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function readSheet(sheet) {
  const values = sheet.getDataRange().getValues();
  const [headers, ...rows] = values;
  return rows.map((row) =>
    headers.reduce((acc, header, index) => {
      acc[header] = row[index];
      return acc;
    }, {})
  );
}

function appendRow(sheet, data) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((header) => data[header] ?? "");
  sheet.appendRow(row);
}

function updateRow(sheet, id, data) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf("id");
  const rowIndex = values.findIndex((row, index) => index > 0 && row[idIndex] === id);
  if (rowIndex === -1) {
    return;
  }
  const rowNumber = rowIndex + 1;
  headers.forEach((header, index) => {
    if (header in data) {
      sheet.getRange(rowNumber + 1, index + 1).setValue(data[header]);
    }
  });
}

function updateStock(productsSheet, movement) {
  const values = productsSheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf("id");
  const stockIndex = headers.indexOf("stock");
  const lastEntryIndex = headers.indexOf("lastEntry");
  const lastExitIndex = headers.indexOf("lastExit");
  const rowIndex = values.findIndex(
    (row, index) => index > 0 && row[idIndex] === movement.productId
  );
  if (rowIndex === -1) {
    return;
  }

  const rowNumber = rowIndex + 1;
  const currentStock = Number(values[rowIndex][stockIndex] || 0);
  const updatedStock =
    movement.type === "entrada"
      ? currentStock + Number(movement.quantity)
      : Math.max(0, currentStock - Number(movement.quantity));

  productsSheet.getRange(rowNumber + 1, stockIndex + 1).setValue(updatedStock);
  if (movement.type === "entrada") {
    productsSheet.getRange(rowNumber + 1, lastEntryIndex + 1).setValue(movement.date);
  } else {
    productsSheet.getRange(rowNumber + 1, lastExitIndex + 1).setValue(movement.date);
  }
}

function jsonResponse(data, status) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setStatusCode(status || 200);
}
