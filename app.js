const SHEETS_ENDPOINT = ""; // Cole a URL do seu Web App do Google Apps Script.

const state = {
  products: [],
  movements: [],
};

const productForm = document.getElementById("product-form");
const movementForm = document.getElementById("movement-form");
const productTable = document.getElementById("product-table");
const summaryTable = document.getElementById("summary-table");
const filterName = document.getElementById("filter-name");
const filterSupplier = document.getElementById("filter-supplier");
const totalStock = document.getElementById("total-stock");
const topSupplier = document.getElementById("top-supplier");
const refreshBtn = document.getElementById("refresh-btn");
const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const cancelEdit = document.getElementById("cancel-edit");

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "-";

const today = () => new Date().toISOString().slice(0, 10);

const setInitialDates = () => {
  productForm.createdAt.value = today();
  movementForm.date.value = today();
};

const saveLocalData = () => {
  localStorage.setItem("estoque_products", JSON.stringify(state.products));
  localStorage.setItem("estoque_movements", JSON.stringify(state.movements));
};

const loadLocalData = () => {
  const products = JSON.parse(localStorage.getItem("estoque_products") || "[]");
  const movements = JSON.parse(localStorage.getItem("estoque_movements") || "[]");
  state.products = products;
  state.movements = movements;
};

const fetchApi = async (payload) => {
  if (!SHEETS_ENDPOINT) {
    return { ok: true, data: null };
  }
  const response = await fetch(SHEETS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return { ok: response.ok, data };
};

const loadFromSheets = async () => {
  if (!SHEETS_ENDPOINT) {
    loadLocalData();
    return;
  }
  const response = await fetchApi({ action: "list" });
  if (response.ok && response.data) {
    state.products = response.data.products || [];
    state.movements = response.data.movements || [];
  }
};

const renderSelect = () => {
  const select = movementForm.productId;
  select.innerHTML = "";
  state.products.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = product.name;
    select.appendChild(option);
  });
};

const renderProducts = () => {
  const nameFilter = filterName.value.toLowerCase();
  const supplierFilter = filterSupplier.value.toLowerCase();

  const filtered = state.products.filter((product) => {
    const matchesName = product.name.toLowerCase().includes(nameFilter);
    const matchesSupplier = product.supplier.toLowerCase().includes(supplierFilter);
    return matchesName && matchesSupplier;
  });

  productTable.innerHTML = "";
  filtered.forEach((product) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${product.name}</td>
      <td>${product.supplier}</td>
      <td>${product.stock}</td>
      <td>${formatDate(product.createdAt)}</td>
      <td>${formatDate(product.lastEntry)}</td>
      <td>${formatDate(product.lastExit)}</td>
      <td>
        <button class="secondary" data-action="edit" data-id="${product.id}">Editar</button>
      </td>
    `;
    productTable.appendChild(row);
  });
};

const getMovementsByProduct = (productId) =>
  state.movements.filter((movement) => movement.productId === productId);

const getPeriodTotals = (productId, period) => {
  const now = new Date();
  const movements = getMovementsByProduct(productId).filter((movement) => {
    const date = new Date(movement.date);
    if (period === "day") {
      return date.toDateString() === now.toDateString();
    }
    if (period === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return date >= start && date <= now;
    }
    if (period === "month") {
      return date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
    }
    return false;
  });

  return movements.reduce(
    (totals, movement) => {
      if (movement.type === "entrada") {
        totals.entrada += movement.quantity;
      } else {
        totals.saida += movement.quantity;
      }
      return totals;
    },
    { entrada: 0, saida: 0 }
  );
};

const renderSummary = () => {
  summaryTable.innerHTML = "";
  let stockSum = 0;
  const supplierMonthTotals = {};

  state.products.forEach((product) => {
    stockSum += Number(product.stock || 0);

    const dayTotals = getPeriodTotals(product.id, "day");
    const weekTotals = getPeriodTotals(product.id, "week");
    const monthTotals = getPeriodTotals(product.id, "month");

    supplierMonthTotals[product.supplier] =
      (supplierMonthTotals[product.supplier] || 0) + monthTotals.entrada;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${product.name}</td>
      <td>${dayTotals.entrada}</td>
      <td>${dayTotals.saida}</td>
      <td>${weekTotals.entrada}</td>
      <td>${weekTotals.saida}</td>
      <td>${monthTotals.entrada}</td>
      <td>${monthTotals.saida}</td>
    `;
    summaryTable.appendChild(row);
  });

  totalStock.textContent = stockSum.toString();

  const topEntry = Object.entries(supplierMonthTotals).sort((a, b) => b[1] - a[1])[0];
  topSupplier.textContent = topEntry ? `${topEntry[0]} (${topEntry[1]})` : "-";
};

const renderAll = () => {
  renderSelect();
  renderProducts();
  renderSummary();
};

const addProduct = async (payload) => {
  const newProduct = {
    id: crypto.randomUUID(),
    name: payload.name,
    supplier: payload.supplier,
    stock: Number(payload.stock),
    createdAt: payload.createdAt,
    lastEntry: payload.createdAt,
    lastExit: null,
  };
  state.products.push(newProduct);

  if (!SHEETS_ENDPOINT) {
    saveLocalData();
    return;
  }
  await fetchApi({ action: "addProduct", data: newProduct });
};

const updateProduct = async (payload) => {
  const index = state.products.findIndex((product) => product.id === payload.id);
  if (index === -1) return;
  state.products[index] = { ...state.products[index], ...payload };

  if (!SHEETS_ENDPOINT) {
    saveLocalData();
    return;
  }
  await fetchApi({ action: "updateProduct", data: payload });
};

const addMovement = async (payload) => {
  const movement = {
    id: crypto.randomUUID(),
    productId: payload.productId,
    type: payload.type,
    quantity: Number(payload.quantity),
    date: payload.date,
  };
  state.movements.push(movement);

  const product = state.products.find((item) => item.id === payload.productId);
  if (product) {
    if (payload.type === "entrada") {
      product.stock += Number(payload.quantity);
      product.lastEntry = payload.date;
    } else {
      product.stock = Math.max(0, product.stock - Number(payload.quantity));
      product.lastExit = payload.date;
    }
  }

  if (!SHEETS_ENDPOINT) {
    saveLocalData();
    return;
  }
  await fetchApi({ action: "addMovement", data: movement });
};

const handleEdit = (productId) => {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  editForm.id.value = product.id;
  editForm.name.value = product.name;
  editForm.supplier.value = product.supplier;
  editForm.stock.value = product.stock;
  editModal.showModal();
};

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(productForm));
  await addProduct(data);
  productForm.reset();
  setInitialDates();
  renderAll();
});

movementForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(movementForm));
  await addMovement(data);
  movementForm.reset();
  movementForm.date.value = today();
  renderAll();
});

productTable.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  if (target.dataset.action === "edit") {
    handleEdit(target.dataset.id);
  }
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(editForm));
  await updateProduct({
    id: data.id,
    name: data.name,
    supplier: data.supplier,
    stock: Number(data.stock),
  });
  editModal.close();
  renderAll();
});

cancelEdit.addEventListener("click", () => {
  editModal.close();
});

[filterName, filterSupplier].forEach((input) => {
  input.addEventListener("input", renderProducts);
});

refreshBtn.addEventListener("click", async () => {
  await loadFromSheets();
  renderAll();
});

const init = async () => {
  setInitialDates();
  await loadFromSheets();
  renderAll();
};

init();
