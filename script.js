const STORAGE_KEY = "accountingPracticeData";
const SIDEBAR_KEY = "accountingSidebarHidden";

const defaultState = {
  businessName: "",
  accountingPeriod: "",
  activeSection: "journal",
  journal: [],
  ledgers: [],
  trialBalance: [],
  trading: { left: [], right: [] },
  profitLoss: { left: [], right: [] },
  balanceSheet: { left: [], right: [] },
};

let pendingConfirm = null;

const sectionMeta = {
  journal: {
    title: "Journal",
    description:
      "Record complete journal entries with flexible debit and credit lines.",
  },
  ledger: {
    title: "Ledger",
    description:
      "Create independent Dr. and Cr. ledger accounts and post manually.",
  },
  trialBalance: {
    title: "Trial Balance",
    description:
      "Enter each account and its manually determined debit or credit balance.",
  },
  trading: {
    title: "Trading Account",
    description:
      "Prepare both sides manually without automatic totals or gross profit calculations.",
  },
  profitLoss: {
    title: "Profit & Loss Account",
    description:
      "Enter income and expenses manually on the traditional two-sided format.",
  },
  balanceSheet: {
    title: "Balance Sheet",
    description:
      "Enter liabilities and assets manually in the traditional statement format.",
  },
};

const content = document.getElementById("content");
const appShell = document.querySelector(".app-shell");
const sidebarToggle = document.getElementById("sidebarToggle");
const sectionTitle = document.getElementById("sectionTitle");
const sectionDescription = document.getElementById("sectionDescription");
const sectionActions = document.getElementById("sectionActions");
const menuLayer = document.getElementById("menuLayer");
const saveStatus = document.getElementById("saveStatus");
const confirmDialog = document.getElementById("confirmDialog");

let state = loadState();

function createId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyJournalEntry() {
  return {
    id: createId(),
    date: "",
    lf: "",
    lines: [],
    narration: null,
  };
}

function emptyJournalLine(type = "debit") {
  return {
    id: createId(),
    type,
    account: "",
    lf: "",
    amount: "",
  };
}

function emptyLedger() {
  return {
    id: createId(),
    name: "",
    debit: [],
    credit: [],
  };
}

function emptyLedgerLine() {
  return {
    id: createId(),
    date: "",
    particulars: "",
    jf: "",
    amount: "",
  };
}

function emptyTBRow() {
  return {
    id: createId(),
    account: "",
    lf: "",
    debit: "",
    credit: "",
  };
}

function emptyStatementRow() {
  return {
    id: createId(),
    particulars: "",
    amount: "",
  };
}

function createPairedLedgerRows(ledger) {
  const difference = ledger.debit.length - ledger.credit.length;

  if (difference > 0) {
    for (let i = 0; i < difference; i++) {
      ledger.credit.push(emptyLedgerLine());
    }
  } else if (difference < 0) {
    for (let i = 0; i < Math.abs(difference); i++) {
      ledger.debit.push(emptyLedgerLine());
    }
  }
}

function createPairedStatementRows(statement) {
  const difference = statement.left.length - statement.right.length;

  if (difference > 0) {
    for (let i = 0; i < difference; i++) {
      statement.right.push(emptyStatementRow());
    }
  } else if (difference < 0) {
    for (let i = 0; i < Math.abs(difference); i++) {
      statement.left.push(emptyStatementRow());
    }
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      console.log("No saved accounting data found.");
      return clone(defaultState);
    }

    const parsed = JSON.parse(saved);
    const normalized = normalizeState(parsed);

    return normalized;
  } catch (error) {
    console.error("Failed to load accounting data:", error);
    return clone(defaultState);
  }
}

function normalizeState(parsed) {
  const base = clone(defaultState);

  if (!parsed || typeof parsed !== "object") {
    return base;
  }

  const result = {
    ...base,
    ...parsed,
  };

  result.businessName = String(result.businessName ?? "");
  result.accountingPeriod = String(result.accountingPeriod ?? "");

  result.activeSection =
    result.activeSection in sectionMeta ? result.activeSection : "journal";

  result.journal = Array.isArray(result.journal) ? result.journal : [];
  result.ledgers = Array.isArray(result.ledgers) ? result.ledgers : [];
  result.trialBalance = Array.isArray(result.trialBalance)
    ? result.trialBalance
    : [];

  result.journal = result.journal.map((entry) => ({
    id: entry.id || createId(),
    date: String(entry.date ?? ""),
    lf: String(entry.lf ?? ""),
    lines: Array.isArray(entry.lines)
      ? entry.lines.map((line) => ({
          id: line.id || createId(),
          type: line.type === "credit" ? "credit" : "debit",
          account: String(line.account ?? ""),
          lf: String(line.lf ?? ""),
          amount: String(line.amount ?? ""),
        }))
      : [],
    narration:
      entry.narration === null || entry.narration === undefined
        ? null
        : String(entry.narration),
  }));

  result.ledgers = result.ledgers.map((ledger) => {
    const normalizedLedger = {
      id: ledger.id || createId(),
      name: String(ledger.name ?? ""),
      debit: normalizeLedgerRows(ledger.debit),
      credit: normalizeLedgerRows(ledger.credit),
    };

    createPairedLedgerRows(normalizedLedger);

    return normalizedLedger;
  });

  result.trialBalance = result.trialBalance.map((row) => ({
    id: row.id || createId(),
    account: String(row.account ?? ""),
    lf: String(row.lf ?? ""),
    debit: String(row.debit ?? ""),
    credit: String(row.credit ?? ""),
  }));

  for (const key of ["trading", "profitLoss", "balanceSheet"]) {
    const source =
      parsed[key] && typeof parsed[key] === "object" ? parsed[key] : base[key];

    result[key] = {
      left: normalizeStatementRows(source.left),
      right: normalizeStatementRows(source.right),
    };

    createPairedStatementRows(result[key]);
  }

  result.journal.forEach(normalizeJournalLineOrder);

  return result;
}

function normalizeLedgerRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ({
    id: row.id || createId(),
    date: String(row.date ?? ""),
    particulars: String(row.particulars ?? ""),
    jf: String(row.jf ?? ""),
    amount: String(row.amount ?? ""),
  }));
}

function normalizeStatementRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ({
    id: row.id || createId(),
    particulars: String(row.particulars ?? ""),
    amount: String(row.amount ?? ""),
  }));
}

function saveState() {
  try {
    const data = JSON.stringify(state);

    localStorage.setItem(STORAGE_KEY, data);

    // Verify that the browser actually stored it.
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved === data) {
      saveStatus.textContent = "Saved";
    } else {
      saveStatus.textContent = "Save failed";
      console.error("localStorage verification failed.");
    }
  } catch (error) {
    saveStatus.textContent = "Storage unavailable";

    console.error("Failed to save accounting data:", error);
  }
}

function formatAmount(value) {
  const raw = String(value ?? "").trim();

  if (!raw) return "";

  const negative = raw.startsWith("-");
  const digits = raw.replace(/[^0-9]/g, "");

  if (!digits) return raw;

  const number = Number(digits);

  if (!Number.isFinite(number)) {
    return raw;
  }

  return `${negative ? "-" : ""}${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(number)}`;
}

function unformatAmount(value) {
  return String(value ?? "").replace(/,/g, "");
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function render() {
  if (!(state.activeSection in sectionMeta)) {
    state.activeSection = "journal";
  }

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.section === state.activeSection,
    );
  });

  const meta = sectionMeta[state.activeSection];

  sectionTitle.textContent = meta.title;
  sectionDescription.textContent = meta.description;

  renderBusinessHeader();

  sectionActions.innerHTML = renderSectionActions();

  switch (state.activeSection) {
    case "journal":
      renderJournal();
      break;

    case "ledger":
      renderLedger();
      break;

    case "trialBalance":
      renderTrialBalance();
      break;

    case "trading":
      renderDoubleStatement("trading", "Trading Account");
      break;

    case "profitLoss":
      renderDoubleStatement("profitLoss", "Profit & Loss Account");
      break;

    case "balanceSheet":
      renderBalanceSheet();
      break;
  }
}

function renderBusinessHeader() {
  document.getElementById("headerBusiness").textContent =
    state.businessName.trim() || "Untitled Business";

  document.getElementById("headerPeriod").textContent =
    state.accountingPeriod.trim() || "No accounting period";

  document.getElementById("businessName").value = state.businessName;
  document.getElementById("accountingPeriod").value = state.accountingPeriod;
}

function renderSectionActions() {
  const actions = {
    journal:
      '<button class="button" data-action="add-journal-entry" type="button">+ Add Journal Entry</button>',

    ledger:
      '<button class="button" data-action="create-ledger" type="button">+ Create Ledger</button>',

    trialBalance:
      '<button class="button" data-action="add-tb-row" type="button">+ Add Account</button>',

    trading:
      '<button class="button" data-action="add-statement-row" data-side="left" data-target="trading" type="button">+ Add Row</button>',

    profitLoss:
      '<button class="button" data-action="add-statement-row" data-side="left" data-target="profitLoss" type="button">+ Add Row</button>',

    balanceSheet:
      '<button class="button" data-action="add-statement-row" data-side="left" data-target="balanceSheet" type="button">+ Add Row</button>',
  };

  return actions[state.activeSection] || "";
}

/* =========================
   JOURNAL
========================= */

function renderJournal() {
  const entries = state.journal;

  content.innerHTML = `
    <div class="paper journal-paper">

      <div class="paper-header">
        <div>${esc(state.businessName)}</div>
        <div class="center-title">Journal</div>
        <div class="right-meta">${esc(state.accountingPeriod)}</div>
      </div>

      ${
        entries.length
          ? entries.map(renderJournalEntry).join("")
          : `
            <div class="empty-state">
              <strong>Your journal is empty.</strong>
              <p>
                Add the first complete journal entry. Debit and credit
                lines remain entirely under your control.
              </p>

              <button
                class="button"
                data-action="add-journal-entry"
                type="button"
              >
                + Add Journal Entry
              </button>
            </div>
          `
      }

    </div>
  `;
}

function renderJournalEntry(entry) {
  normalizeJournalLineOrder(entry);

  const debitLines = entry.lines.filter((line) => line.type === "debit");

  const creditLines = entry.lines.filter((line) => line.type === "credit");

  const orderedLines = [...debitLines, ...creditLines];

  return `
    <article
      class="journal-entry"
      data-entry-id="${entry.id}"
    >

      <div class="entry-number">
        <span>Journal Entry</span>
      </div>

      <div class="entry-meta">

        <input
          class="cell-input"
          data-model="journal"
          data-entry-id="${entry.id}"
          data-field="date"
          value="${esc(entry.date)}"
          placeholder="Date"
          aria-label="Journal entry date"
        />

        <div></div>

        <input
          class="cell-input lf-input"
          data-model="journal"
          data-entry-id="${entry.id}"
          data-field="lf"
          value="${esc(entry.lf)}"
          placeholder="L.F."
          aria-label="Journal entry ledger folio"
        />

        <button
          class="entry-menu-button"
          type="button"
          data-menu="journal-entry"
          data-id="${entry.id}"
          aria-label="Journal entry actions"
          aria-haspopup="menu"
        >
          ⋮
        </button>

      </div>

      <div class="journal-table-wrap">

        <table class="journal-table">

          <thead>
            <tr>
              <th class="particulars-col">Particulars</th>
              <th class="lf-col">L.F.</th>
              <th class="amount-col amount-head">Debit</th>
              <th class="amount-col amount-head">Credit</th>
              <th class="action-col"></th>
            </tr>
          </thead>

          <tbody>
            ${
              orderedLines.length
                ? orderedLines
                    .map((line) => renderJournalLine(entry, line))
                    .join("")
                : `
                  <tr>
                    <td colspan="5" class="no-lines">
                      No journal lines
                    </td>
                  </tr>
                `
            }
          </tbody>

        </table>

      </div>

      <div class="entry-toolbar">

        <button
          class="text-action"
          type="button"
          data-action="add-journal-line"
          data-entry-id="${entry.id}"
          data-type="debit"
        >
          + Debit
        </button>

        <button
          class="text-action"
          type="button"
          data-action="add-journal-line"
          data-entry-id="${entry.id}"
          data-type="credit"
        >
          + Credit
        </button>

        <button
          class="text-action"
          type="button"
          data-action="add-narration"
          data-entry-id="${entry.id}"
        >
          + Narration
        </button>

      </div>

      ${
        entry.narration !== null
          ? `
            <div class="narration-row">

              <span class="narration-prefix">(Being</span>

              <input
                class="cell-input narration-input"
                data-model="journal"
                data-entry-id="${entry.id}"
                data-field="narration"
                value="${esc(entry.narration)}"
                placeholder="Narration"
              />

              <span>)</span>

            </div>
          `
          : ""
      }

    </article>
  `;
}

function renderJournalLine(entry, line) {
  const isDebit = line.type === "debit";

  return `
    <tr
      class="journal-line ${line.type}"
      data-line-id="${line.id}"
    >

      <td class="particular-cell">

        <div class="account-input-wrap">

          ${!isDebit ? `<span class="account-prefix">To</span>` : ""}

          <input
            class="cell-input account-input"
            data-model="journal-line"
            data-entry-id="${entry.id}"
            data-line-id="${line.id}"
            data-field="account"
            value="${esc(line.account)}"
            placeholder="Account name"
            aria-label="Account name"
          />

        </div>

      </td>

      <td>

        <input
          class="cell-input"
          data-model="journal-line"
          data-entry-id="${entry.id}"
          data-line-id="${line.id}"
          data-field="lf"
          value="${esc(line.lf)}"
          placeholder=""
          aria-label="Line ledger folio"
        />

      </td>

      <td>

        <input
          class="cell-input amount-input"
          data-model="journal-line"
          data-entry-id="${entry.id}"
          data-line-id="${line.id}"
          data-field="amount"
          data-amount="true"
          value="${esc(isDebit ? formatAmount(line.amount) : "")}"
          ${!isDebit ? "disabled" : ""}
          placeholder=""
          aria-label="Debit amount"
        />

      </td>

      <td>

        <input
          class="cell-input amount-input"
          data-model="journal-line"
          data-entry-id="${entry.id}"
          data-line-id="${line.id}"
          data-field="amount"
          data-amount="true"
          value="${esc(!isDebit ? formatAmount(line.amount) : "")}"
          ${isDebit ? "disabled" : ""}
          placeholder=""
          aria-label="Credit amount"
        />

      </td>

      <td>

        <button
          class="icon-button line-action"
          type="button"
          data-menu="journal-line"
          data-id="${entry.id}"
          data-line-id="${line.id}"
          aria-label="Line actions"
          aria-haspopup="menu"
        >
          ⋮
        </button>

      </td>

    </tr>
  `;
}

function addJournalEntry() {
  const entry = emptyJournalEntry();

  entry.lines.push(emptyJournalLine("debit"), emptyJournalLine("credit"));

  state.journal.push(entry);

  saveState();
  renderJournal();

  focusSelector(
    `[data-model="journal"][data-entry-id="${entry.id}"][data-field="date"]`,
  );
}

function addJournalLine(entryId, type) {
  const entry = state.journal.find((item) => item.id === entryId);

  if (!entry) return;

  const line = emptyJournalLine(type);

  if (type === "debit") {
    const firstCreditIndex = entry.lines.findIndex(
      (item) => item.type === "credit",
    );

    if (firstCreditIndex === -1) {
      entry.lines.push(line);
    } else {
      entry.lines.splice(firstCreditIndex, 0, line);
    }
  } else {
    entry.lines.push(line);
  }

  normalizeJournalLineOrder(entry);

  saveState();
  renderJournal();

  focusSelector(
    `[data-model="journal-line"][data-entry-id="${entryId}"][data-line-id="${line.id}"][data-field="account"]`,
  );
}

function addNarration(entryId) {
  const entry = state.journal.find((item) => item.id === entryId);

  if (!entry) return;

  if (entry.narration === null || entry.narration === undefined) {
    entry.narration = "";
  }

  saveState();
  renderJournal();

  focusSelector(
    `[data-model="journal"][data-entry-id="${entryId}"][data-field="narration"]`,
  );
}

function normalizeJournalLineOrder(entry) {
  const debits = entry.lines.filter((line) => line.type === "debit");

  const credits = entry.lines.filter((line) => line.type === "credit");

  entry.lines = [...debits, ...credits];
}

/* =========================
   LEDGER
========================= */

function renderLedger() {
  content.innerHTML = state.ledgers.length
    ? `
      <div class="ledger-list">
        ${state.ledgers.map(renderLedgerCard).join("")}
      </div>
    `
    : `
      <div class="paper">
        <div class="empty-state">
          <strong>No ledger accounts yet.</strong>
          <p>
            Create each ledger independently. Nothing is posted
            automatically from the Journal.
          </p>

          <button
            class="button"
            type="button"
            data-action="create-ledger"
          >
            + Create Ledger
          </button>
        </div>
      </div>
    `;
}

function renderLedgerCard(ledger) {
  return `
    <article
      class="ledger-card"
      data-ledger-id="${ledger.id}"
    >

      <header class="ledger-card-head">

        <input
          class="cell-input ledger-name-input"
          data-model="ledger"
          data-id="${ledger.id}"
          data-field="name"
          value="${esc(ledger.name)}"
          placeholder="Ledger account name"
          aria-label="Ledger account name"
        />

        <button
          class="icon-button"
          type="button"
          data-menu="ledger"
          data-id="${ledger.id}"
          aria-label="Ledger actions"
          aria-haspopup="menu"
        >
          ⋮
        </button>

      </header>

      <div class="ledger-columns">

        ${renderLedgerSide(ledger, "debit", "Dr.")}

        ${renderLedgerSide(ledger, "credit", "Cr.")}

      </div>

      <div class="add-row-strip">

        <button
          class="add-row-button"
          type="button"
          data-action="add-ledger-row"
          data-ledger-id="${ledger.id}"
        >
          + Add Row
        </button>

      </div>

    </article>
  `;
}

function renderLedgerSide(ledger, side, title) {
  const rows = ledger[side];

  return `
    <div class="ledger-side">

      <div class="ledger-side-title">
        ${title}
      </div>

      <div class="standard-table-wrap">

        <table class="ledger-table">

          <thead>
            <tr>
              <th class="date-col">Date</th>
              <th>Particulars</th>
              <th class="jf-col">J.F.</th>
              <th class="amount-col">Amount</th>
              <th class="menu-col"></th>
            </tr>
          </thead>

          <tbody>

            ${
              rows.length
                ? rows
                    .map(
                      (row) => `
                        <tr
                          data-ledger-id="${ledger.id}"
                          data-side="${side}"
                          data-row-id="${row.id}"
                        >

                          <td>
                            <input
                              class="cell-input"
                              data-model="ledger-line"
                              data-ledger-id="${ledger.id}"
                              data-side="${side}"
                              data-row-id="${row.id}"
                              data-field="date"
                              value="${esc(row.date)}"
                            />
                          </td>

                          <td>
                            <input
                              class="cell-input"
                              data-model="ledger-line"
                              data-ledger-id="${ledger.id}"
                              data-side="${side}"
                              data-row-id="${row.id}"
                              data-field="particulars"
                              value="${esc(row.particulars)}"
                            />
                          </td>

                          <td>
                            <input
                              class="cell-input"
                              data-model="ledger-line"
                              data-ledger-id="${ledger.id}"
                              data-side="${side}"
                              data-row-id="${row.id}"
                              data-field="jf"
                              value="${esc(row.jf)}"
                            />
                          </td>

                          <td>
                            <input
                              class="cell-input amount-input"
                              data-model="ledger-line"
                              data-ledger-id="${ledger.id}"
                              data-side="${side}"
                              data-row-id="${row.id}"
                              data-field="amount"
                              data-amount="true"
                              value="${esc(formatAmount(row.amount))}"
                            />
                          </td>

                          <td>
                            <button
                              class="icon-button line-menu"
                              type="button"
                              data-menu="ledger-line"
                              data-ledger-id="${ledger.id}"
                              data-side="${side}"
                              data-row-id="${row.id}"
                              aria-label="Ledger row actions"
                            >
                              ⋮
                            </button>
                          </td>

                        </tr>
                      `,
                    )
                    .join("")
                : `
                  <tr>
                    <td colspan="5" class="no-lines">
                      No entries
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>

    </div>
  `;
}

function createLedger() {
  const ledger = emptyLedger();

  state.ledgers.push(ledger);

  saveState();
  renderLedger();

  focusSelector(`[data-model="ledger"][data-id="${ledger.id}"]`);
}

function addLedgerRow(ledgerId, side) {
  const ledger = state.ledgers.find((item) => item.id === ledgerId);

  if (!ledger) return;

  const clickedRow = emptyLedgerLine();
  const pairedRow = emptyLedgerLine();

  ledger[side].push(clickedRow);

  const oppositeSide = side === "debit" ? "credit" : "debit";

  ledger[oppositeSide].push(pairedRow);

  saveState();
  renderLedger();

  focusSelector(
    `[data-model="ledger-line"][data-ledger-id="${ledgerId}"][data-side="${side}"][data-row-id="${clickedRow.id}"][data-field="date"]`,
  );
}

/* =========================
   TRIAL BALANCE
========================= */

function renderTrialBalance() {
  content.innerHTML = `
    <div class="paper">

      <div class="paper-header">
        <div>${esc(state.businessName)}</div>
        <div class="center-title">Trial Balance</div>
        <div class="right-meta">${esc(state.accountingPeriod)}</div>
      </div>

      <div class="standard-table-wrap">

        <table class="standard-table">

          <thead>
            <tr>
              <th class="number-col">S. No.</th>
              <th>Name of Account</th>
              <th class="lf-col">L.F.</th>
              <th class="amount-col">Debit</th>
              <th class="amount-col">Credit</th>
              <th class="menu-col"></th>
            </tr>
          </thead>

          <tbody>

            ${
              state.trialBalance.length
                ? state.trialBalance
                    .map(
                      (row, index) => `
                        <tr data-row-id="${row.id}">

                          <td class="number-col">
                            ${index + 1}
                          </td>

                          <td>
                            <input
                              class="cell-input"
                              data-model="trial"
                              data-row-id="${row.id}"
                              data-field="account"
                              value="${esc(row.account)}"
                            />
                          </td>

                          <td>
                            <input
                              class="cell-input"
                              data-model="trial"
                              data-row-id="${row.id}"
                              data-field="lf"
                              value="${esc(row.lf)}"
                            />
                          </td>

                          <td>
                            <input
                              class="cell-input amount-input"
                              data-model="trial"
                              data-row-id="${row.id}"
                              data-field="debit"
                              data-amount="true"
                              value="${esc(formatAmount(row.debit))}"
                            />
                          </td>

                          <td>
                            <input
                              class="cell-input amount-input"
                              data-model="trial"
                              data-row-id="${row.id}"
                              data-field="credit"
                              data-amount="true"
                              value="${esc(formatAmount(row.credit))}"
                            />
                          </td>

                          <td>
                            <button
                              class="icon-button line-menu"
                              type="button"
                              data-menu="trial-row"
                              data-id="${row.id}"
                              aria-label="Trial balance row actions"
                            >
                              ⋮
                            </button>
                          </td>

                        </tr>
                      `,
                    )
                    .join("")
                : `
                  <tr>
                    <td colspan="6" class="no-lines">
                      No accounts entered
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>

      <div class="add-row-strip">
        <button
          class="add-row-button"
          type="button"
          data-action="add-tb-row"
        >
          + Add Account
        </button>
      </div>

    </div>
  `;
}

function addTBRow() {
  const row = emptyTBRow();

  state.trialBalance.push(row);

  saveState();
  renderTrialBalance();

  focusSelector(
    `[data-model="trial"][data-row-id="${row.id}"][data-field="account"]`,
  );
}

/* =========================
   TRADING / P&L / BALANCE
========================= */

function renderDoubleStatement(key, title) {
  const data = state[key];

  content.innerHTML = `
    <div class="double-table">

      <div class="double-table-inner">

        <div class="double-title">
          ${esc(title)}
        </div>

        <div class="double-head">
          <div>Particulars</div>
          <div>Amount</div>
          <div>Particulars</div>
          <div>Amount</div>
        </div>

        ${renderDoubleRows(key, data)}

        <div class="double-add">

          <button
            class="add-row-button"
            type="button"
            data-action="add-statement-row"
            data-side="left"
            data-target="${key}"
          >
            + Add Row
          </button>

        </div>

      </div>

    </div>
  `;
}

function renderDoubleRows(key, data) {
  const max = Math.max(data.left.length, data.right.length, 1);

  let html = "";

  for (let i = 0; i < max; i++) {
    const left = data.left[i];
    const right = data.right[i];

    html += `
      <div class="double-row">

        ${renderStatementCell(key, "left", left)}

        ${renderStatementCell(key, "left", left, true)}

        ${renderStatementCell(key, "right", right)}

        ${renderStatementCell(key, "right", right, true)}

      </div>
    `;
  }

  return html;
}

function renderStatementCell(key, side, row, amount = false) {
  if (!row) {
    return `<div class="blank-statement-cell"></div>`;
  }

  if (amount) {
    return `
      <div class="statement-amount-cell">
        <input
          class="cell-input amount-input"
          data-model="statement"
          data-target="${key}"
          data-side="${side}"
          data-row-id="${row.id}"
          data-field="amount"
          data-amount="true"
          value="${esc(formatAmount(row.amount))}"
        />
      </div>
    `;
  }

  return `
    <div class="statement-particular-cell">

      <input
        class="cell-input"
        data-model="statement"
        data-target="${key}"
        data-side="${side}"
        data-row-id="${row.id}"
        data-field="particulars"
        value="${esc(row.particulars)}"
        placeholder="Particulars"
      />

      <button
        class="icon-button line-menu"
        type="button"
        data-menu="statement-row"
        data-target="${key}"
        data-side="${side}"
        data-id="${row.id}"
        aria-label="Statement row actions"
      >
        ⋮
      </button>

    </div>
  `;
}

function renderBalanceSheet() {
  renderDoubleStatement("balanceSheet", "Balance Sheet");
}

function addStatementRow(key, side) {
  const statement = state[key];

  if (!statement) return;

  const clickedRow = emptyStatementRow();
  const pairedRow = emptyStatementRow();

  statement[side].push(clickedRow);

  const oppositeSide = side === "left" ? "right" : "left";

  statement[oppositeSide].push(pairedRow);

  saveState();

  if (key === "balanceSheet") {
    renderBalanceSheet();
  } else {
    renderDoubleStatement(key, sectionMeta[key].title);
  }

  focusSelector(
    `[data-model="statement"][data-target="${key}"][data-side="${side}"][data-row-id="${clickedRow.id}"][data-field="particulars"]`,
  );
}

/* =========================
   MOVEMENT / INSERT
========================= */

function moveItem(array, id, direction) {
  const index = array.findIndex((item) => item.id === id);

  if (index === -1) return;

  const next = index + direction;

  if (next < 0 || next >= array.length) {
    return;
  }

  [array[index], array[next]] = [array[next], array[index]];
}

function insertRow(array, id, position, factory) {
  const index = array.findIndex((item) => item.id === id);

  const row = factory();

  if (index === -1) {
    array.push(row);
    return row;
  }

  array.splice(Math.max(0, index + position), 0, row);

  return row;
}

function insertJournalLine(entry, lineId, type, position) {
  const line = emptyJournalLine(type);

  const index = entry.lines.findIndex((item) => item.id === lineId);

  if (index === -1) {
    entry.lines.push(line);
    normalizeJournalLineOrder(entry);
    return line;
  }

  if (position === 0) {
    entry.lines.splice(index, 0, line);
  } else {
    entry.lines.splice(index + 1, 0, line);
  }

  normalizeJournalLineOrder(entry);

  return line;
}

/* =========================
   DELETE / CONFIRM
========================= */

function requestDelete(title, message, callback) {
  pendingConfirm = callback;

  document.getElementById("confirmTitle").textContent = title;

  document.getElementById("confirmMessage").textContent = message;

  if (!confirmDialog.open) {
    confirmDialog.showModal();
  }
}

function executeDelete() {
  const callback = pendingConfirm;

  pendingConfirm = null;

  if (confirmDialog.open) {
    confirmDialog.close();
  }

  if (callback) {
    callback();
  }
}

function deleteJournalEntry(id) {
  requestDelete(
    "Delete this journal entry?",
    "This action cannot be undone.",
    () => {
      state.journal = state.journal.filter((item) => item.id !== id);

      saveState();
      renderJournal();
    },
  );
}

function deleteJournalLine(entryId, lineId) {
  requestDelete(
    "Delete this journal line?",
    "This action cannot be undone.",
    () => {
      const entry = state.journal.find((item) => item.id === entryId);

      if (!entry) return;

      entry.lines = entry.lines.filter((item) => item.id !== lineId);

      saveState();
      renderJournal();
    },
  );
}

function deleteLedger(id) {
  requestDelete(
    "Delete this ledger?",
    "The entire ledger account and its rows will be removed.",
    () => {
      state.ledgers = state.ledgers.filter((item) => item.id !== id);

      saveState();
      renderLedger();
    },
  );
}

function deleteLedgerRow(ledgerId, side, rowId) {
  requestDelete(
    "Delete this ledger row?",
    "This action cannot be undone.",
    () => {
      const ledger = state.ledgers.find((item) => item.id === ledgerId);

      if (!ledger) return;

      ledger[side] = ledger[side].filter((item) => item.id !== rowId);

      saveState();
      renderLedger();
    },
  );
}

function deleteTBRow(id) {
  requestDelete(
    "Delete this account row?",
    "This action cannot be undone.",
    () => {
      state.trialBalance = state.trialBalance.filter((item) => item.id !== id);

      saveState();
      renderTrialBalance();
    },
  );
}

function deleteStatementRow(key, side, id) {
  requestDelete("Delete this row?", "This action cannot be undone.", () => {
    state[key][side] = state[key][side].filter((item) => item.id !== id);

    saveState();

    if (key === "balanceSheet") {
      renderBalanceSheet();
    } else {
      renderDoubleStatement(key, sectionMeta[key].title);
    }
  });
}

/* =========================
   DUPLICATION
========================= */

function duplicateJournal(entryId) {
  const source = state.journal.find((item) => item.id === entryId);

  if (!source) return;

  const copy = clone(source);

  copy.id = createId();

  copy.lines = copy.lines.map((line) => ({
    ...line,
    id: createId(),
  }));

  const index = state.journal.findIndex((item) => item.id === entryId);

  state.journal.splice(index + 1, 0, copy);

  saveState();
  renderJournal();
}

function duplicateLedger(ledgerId) {
  const source = state.ledgers.find((item) => item.id === ledgerId);

  if (!source) return;

  const copy = clone(source);

  copy.id = createId();

  copy.debit = copy.debit.map((row) => ({
    ...row,
    id: createId(),
  }));

  copy.credit = copy.credit.map((row) => ({
    ...row,
    id: createId(),
  }));

  const index = state.ledgers.findIndex((item) => item.id === ledgerId);

  state.ledgers.splice(index + 1, 0, copy);

  saveState();
  renderLedger();
}

/* =========================
   CONTEXT MENUS
========================= */

function closeMenu() {
  menuLayer.innerHTML = "";
}

function openMenu(type, data, anchor) {
  closeMenu();

  const menu = document.createElement("div");

  menu.className = "context-menu";
  menu.setAttribute("role", "menu");

  const add = (label, action, danger = false) => {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.dataset.menuAction = action;

    if (danger) {
      button.classList.add("delete");
    }

    menu.appendChild(button);
  };

  const separator = () => {
    const element = document.createElement("div");

    element.className = "separator";

    menu.appendChild(element);
  };

  if (type === "journal-entry") {
    add("Edit Entry", "focus-date");
    add("Add Debit Line", "add-debit");
    add("Add Credit Line", "add-credit");
    add("Add Narration", "narration");

    separator();

    add("Duplicate Entry", "duplicate");
    add("Move Up", "up");
    add("Move Down", "down");

    separator();

    add("Delete Entry", "delete", true);
  }

  if (type === "journal-line") {
    add("Edit Line", "edit");
    add("Insert Above", "above");
    add("Insert Below", "below");
    add("Move Up", "up");
    add("Move Down", "down");

    separator();

    add("Delete Line", "delete", true);
  }

  if (type === "ledger") {
    add("Edit Ledger Name", "edit");
    add("Add Row", "add-row");

    separator();

    add("Duplicate Ledger", "duplicate");
    add("Delete Ledger", "delete", true);
  }

  if (type === "ledger-line") {
    add("Edit Row", "edit");
    add("Move Up", "up");
    add("Move Down", "down");

    separator();

    add("Delete Row", "delete", true);
  }

  if (type === "trial-row") {
    add("Edit", "edit");
    add("Insert Above", "above");
    add("Insert Below", "below");
    add("Move Up", "up");
    add("Move Down", "down");

    separator();

    add("Delete", "delete", true);
  }

  if (type === "statement-row") {
    add("Edit", "edit");
    add("Move Up", "up");
    add("Move Down", "down");

    separator();

    add("Delete", "delete", true);
  }

  menuLayer.appendChild(menu);

  const rect = anchor.getBoundingClientRect();

  const width = 190;

  let left = rect.right - width;

  let top = rect.bottom + 5;

  const menuHeight = menu.getBoundingClientRect().height;

  if (left < 8) {
    left = 8;
  }

  if (left + width > window.innerWidth - 8) {
    left = window.innerWidth - width - 8;
  }

  if (top + menuHeight > window.innerHeight - 8) {
    top = rect.top - menuHeight - 5;
  }

  menu.style.left = `${Math.max(8, left)}px`;

  menu.style.top = `${Math.max(8, top)}px`;

  menu.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-menu-action]");

    if (!button) return;

    handleMenuAction(type, button.dataset.menuAction, data);

    closeMenu();
  });
}

function handleMenuAction(type, action, data) {
  /* JOURNAL ENTRY */

  if (type === "journal-entry") {
    const entry = state.journal.find((item) => item.id === data.id);

    if (!entry) return;

    if (action === "focus-date") {
      renderJournal();

      focusSelector(
        `[data-model="journal"][data-entry-id="${entry.id}"][data-field="date"]`,
      );

      return;
    }

    if (action === "add-debit") {
      addJournalLine(entry.id, "debit");
      return;
    }

    if (action === "add-credit") {
      addJournalLine(entry.id, "credit");
      return;
    }

    if (action === "narration") {
      addNarration(entry.id);
      return;
    }

    if (action === "duplicate") {
      duplicateJournal(entry.id);
      return;
    }

    if (action === "up") {
      moveItem(state.journal, entry.id, -1);
    }

    if (action === "down") {
      moveItem(state.journal, entry.id, 1);
    }

    if (action === "delete") {
      deleteJournalEntry(entry.id);
      return;
    }

    saveState();
    renderJournal();

    return;
  }

  /* JOURNAL LINE */

  if (type === "journal-line") {
    const entry = state.journal.find((item) => item.id === data.id);

    if (!entry) return;

    const line = entry.lines.find((item) => item.id === data.lineId);

    if (!line) return;

    if (action === "edit") {
      renderJournal();

      focusSelector(
        `[data-model="journal-line"][data-entry-id="${entry.id}"][data-line-id="${line.id}"][data-field="account"]`,
      );

      return;
    }

    if (action === "above" || action === "below") {
      const newLine = insertJournalLine(
        entry,
        line.id,
        line.type,
        action === "above" ? 0 : 1,
      );

      saveState();
      renderJournal();

      focusSelector(
        `[data-model="journal-line"][data-entry-id="${entry.id}"][data-line-id="${newLine.id}"][data-field="account"]`,
      );

      return;
    }

    if (action === "up") {
      moveJournalLine(entry, line.id, -1);
    }

    if (action === "down") {
      moveJournalLine(entry, line.id, 1);
    }

    if (action === "delete") {
      deleteJournalLine(entry.id, line.id);
      return;
    }

    normalizeJournalLineOrder(entry);

    saveState();
    renderJournal();

    return;
  }

  /* LEDGER */

  if (type === "ledger") {
    const ledger = state.ledgers.find((item) => item.id === data.id);

    if (!ledger) return;

    if (action === "edit") {
      renderLedger();

      focusSelector(`[data-model="ledger"][data-id="${ledger.id}"]`);

      return;
    }

    if (action === "add-row") {
      addLedgerRow(ledger.id, "debit");
      return;
    }

    if (action === "duplicate") {
      duplicateLedger(ledger.id);
      return;
    }

    if (action === "delete") {
      deleteLedger(ledger.id);
      return;
    }
  }

  /* LEDGER LINE */

  if (type === "ledger-line") {
    const ledger = state.ledgers.find((item) => item.id === data.ledgerId);

    if (!ledger) return;

    const rows = ledger[data.side];

    const row = rows.find((item) => item.id === data.rowId);

    if (!row) return;

    if (action === "edit") {
      renderLedger();

      focusSelector(
        `[data-model="ledger-line"][data-ledger-id="${ledger.id}"][data-side="${data.side}"][data-row-id="${row.id}"][data-field="date"]`,
      );

      return;
    }

    if (action === "above" || action === "below") {
      const newRow = insertRow(
        rows,
        row.id,
        action === "above" ? 0 : 1,
        emptyLedgerLine,
      );

      saveState();
      renderLedger();

      focusSelector(
        `[data-model="ledger-line"][data-ledger-id="${ledger.id}"][data-side="${data.side}"][data-row-id="${newRow.id}"][data-field="date"]`,
      );

      return;
    }

    if (action === "up") {
      moveItem(rows, row.id, -1);
    }

    if (action === "down") {
      moveItem(rows, row.id, 1);
    }

    if (action === "delete") {
      deleteLedgerRow(ledger.id, data.side, row.id);
      return;
    }

    saveState();
    renderLedger();

    return;
  }

  /* TRIAL BALANCE */

  if (type === "trial-row") {
    const row = state.trialBalance.find((item) => item.id === data.id);

    if (!row) return;

    if (action === "edit") {
      renderTrialBalance();

      focusSelector(
        `[data-model="trial"][data-row-id="${row.id}"][data-field="account"]`,
      );

      return;
    }

    if (action === "above" || action === "below") {
      const newRow = insertRow(
        state.trialBalance,
        row.id,
        action === "above" ? 0 : 1,
        emptyTBRow,
      );

      saveState();
      renderTrialBalance();

      focusSelector(
        `[data-model="trial"][data-row-id="${newRow.id}"][data-field="account"]`,
      );

      return;
    }

    if (action === "up") {
      moveItem(state.trialBalance, row.id, -1);
    }

    if (action === "down") {
      moveItem(state.trialBalance, row.id, 1);
    }

    if (action === "delete") {
      deleteTBRow(row.id);
      return;
    }

    saveState();
    renderTrialBalance();

    return;
  }

  /* STATEMENTS */

  if (type === "statement-row") {
    const rows = state[data.target][data.side];

    const row = rows.find((item) => item.id === data.id);

    if (!row) return;

    if (action === "edit") {
      render();

      focusSelector(
        `[data-model="statement"][data-target="${data.target}"][data-side="${data.side}"][data-row-id="${row.id}"][data-field="particulars"]`,
      );

      return;
    }

    if (action === "above" || action === "below") {
      const newRow = insertRow(
        rows,
        row.id,
        action === "above" ? 0 : 1,
        emptyStatementRow,
      );

      saveState();
      render();

      focusSelector(
        `[data-model="statement"][data-target="${data.target}"][data-side="${data.side}"][data-row-id="${newRow.id}"][data-field="particulars"]`,
      );

      return;
    }

    if (action === "up") {
      moveItem(rows, row.id, -1);
    }

    if (action === "down") {
      moveItem(rows, row.id, 1);
    }

    if (action === "delete") {
      deleteStatementRow(data.target, data.side, row.id);
      return;
    }

    saveState();
    render();
  }
}

function moveJournalLine(entry, lineId, direction) {
  const sameType = entry.lines.filter(
    (line) =>
      line.type === entry.lines.find((item) => item.id === lineId)?.type,
  );

  const currentIndex = sameType.findIndex((line) => line.id === lineId);

  if (currentIndex === -1) return;

  const nextIndex = currentIndex + direction;

  if (nextIndex < 0 || nextIndex >= sameType.length) {
    return;
  }

  const current = sameType[currentIndex];
  const next = sameType[nextIndex];

  const currentArrayIndex = entry.lines.findIndex(
    (line) => line.id === current.id,
  );

  const nextArrayIndex = entry.lines.findIndex((line) => line.id === next.id);

  [entry.lines[currentArrayIndex], entry.lines[nextArrayIndex]] = [
    entry.lines[nextArrayIndex],
    entry.lines[currentArrayIndex],
  ];
}

/* =========================
   INPUT HANDLING
========================= */

function handleInput(event) {
  const input = event.target.closest("input[data-model]");

  if (!input) return;

  const value =
    input.dataset.amount === "true" ? unformatAmount(input.value) : input.value;

  const model = input.dataset.model;

  if (model === "journal") {
    const entry = state.journal.find(
      (item) => item.id === input.dataset.entryId,
    );

    if (!entry) return;

    entry[input.dataset.field] = value;
  } else if (model === "journal-line") {
    const entry = state.journal.find(
      (item) => item.id === input.dataset.entryId,
    );

    const line = entry?.lines.find((item) => item.id === input.dataset.lineId);

    if (!line) return;

    line[input.dataset.field] = value;
  } else if (model === "ledger") {
    const ledger = state.ledgers.find((item) => item.id === input.dataset.id);

    if (!ledger) return;

    ledger[input.dataset.field] = value;
  } else if (model === "ledger-line") {
    const ledger = state.ledgers.find(
      (item) => item.id === input.dataset.ledgerId,
    );

    const row = ledger?.[input.dataset.side].find(
      (item) => item.id === input.dataset.rowId,
    );

    if (!row) return;

    row[input.dataset.field] = value;
  } else if (model === "trial") {
    const row = state.trialBalance.find(
      (item) => item.id === input.dataset.rowId,
    );

    if (!row) return;

    row[input.dataset.field] = value;
  } else if (model === "statement") {
    const row = state[input.dataset.target][input.dataset.side].find(
      (item) => item.id === input.dataset.rowId,
    );

    if (!row) return;

    row[input.dataset.field] = value;
  }

  saveState();
}

function handleBlur(event) {
  const input = event.target.closest('input[data-amount="true"]');

  if (!input) return;

  const formatted = formatAmount(input.value);

  input.value = formatted;

  const value = unformatAmount(formatted);

  const model = input.dataset.model;

  if (model === "journal-line") {
    const entry = state.journal.find(
      (item) => item.id === input.dataset.entryId,
    );

    const line = entry?.lines.find((item) => item.id === input.dataset.lineId);

    if (line) {
      line.amount = value;
    }
  } else if (model === "ledger-line") {
    const ledger = state.ledgers.find(
      (item) => item.id === input.dataset.ledgerId,
    );

    const row = ledger?.[input.dataset.side].find(
      (item) => item.id === input.dataset.rowId,
    );

    if (row) {
      row.amount = value;
    }
  } else if (model === "trial") {
    const row = state.trialBalance.find(
      (item) => item.id === input.dataset.rowId,
    );

    if (row) {
      row[input.dataset.field] = value;
    }
  } else if (model === "statement") {
    const row = state[input.dataset.target][input.dataset.side].find(
      (item) => item.id === input.dataset.rowId,
    );

    if (row) {
      row.amount = value;
    }
  }

  saveState();
}

/* =========================
   BUTTON ACTIONS
========================= */

function handleAction(event) {
  const button = event.target.closest("[data-action]");

  if (!button) return;

  const action = button.dataset.action;

  switch (action) {
    case "add-journal-entry":
      addJournalEntry();
      break;

    case "add-journal-line":
      addJournalLine(button.dataset.entryId, button.dataset.type);
      break;

    case "add-narration":
      addNarration(button.dataset.entryId);
      break;

    case "create-ledger":
      createLedger();
      break;

    case "add-ledger-row":
      addLedgerRow(button.dataset.ledgerId, "debit");
      break;

    case "add-tb-row":
      addTBRow();
      break;

    case "add-statement-row":
      addStatementRow(button.dataset.target, button.dataset.side);
      break;
  }
}

function handleMenuOpen(event) {
  const button = event.target.closest("[data-menu]");

  if (!button) return;

  event.stopPropagation();

  openMenu(button.dataset.menu, { ...button.dataset }, button);
}

function focusSelector(selector) {
  requestAnimationFrame(() => {
    const element = document.querySelector(selector);

    if (!element) return;

    element.focus();

    if (typeof element.select === "function") {
      element.select();
    }
  });
}

function insertNextInput(current) {
  const inputs = [...content.querySelectorAll("input:not([disabled])")];

  const index = inputs.indexOf(current);

  if (index >= 0 && inputs[index + 1]) {
    inputs[index + 1].focus();

    if (typeof inputs[index + 1].select === "function") {
      inputs[index + 1].select();
    }
  }
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    closeMenu();
    return;
  }

  if (event.key === "Enter" && event.target.matches("input")) {
    if (event.target.dataset.field === "narration") {
      return;
    }

    event.preventDefault();

    insertNextInput(event.target);
  }
}

/* =========================
   GLOBAL EVENTS
========================= */

document.addEventListener("click", (event) => {
  const nav = event.target.closest(".nav-item");

  if (nav) {
    state.activeSection = nav.dataset.section;

    closeMenu();
    saveState();
    render();

    return;
  }

  // Open a three-dot menu
  const menuButton = event.target.closest("[data-menu]");

  if (menuButton) {
    handleMenuOpen(event);
    return;
  }

  // Don't close the menu when clicking inside the menu itself
  if (event.target.closest(".context-menu")) {
    return;
  }

  closeMenu();

  handleAction(event);
});

content.addEventListener("input", handleInput);

content.addEventListener("blur", handleBlur, true);

content.addEventListener("keydown", handleKeydown);

/* =========================
   SIDEBAR
========================= */

function setSidebar(hidden) {
  appShell.classList.toggle("sidebar-hidden", hidden);

  sidebarToggle.setAttribute(
    "aria-label",
    hidden ? "Show sidebar" : "Hide sidebar",
  );

  sidebarToggle.setAttribute("title", hidden ? "Show sidebar" : "Hide sidebar");

  localStorage.setItem(SIDEBAR_KEY, hidden ? "1" : "0");
}

const sidebarHidden = localStorage.getItem(SIDEBAR_KEY) === "1";

setSidebar(sidebarHidden);

sidebarToggle.addEventListener("click", () => {
  setSidebar(!appShell.classList.contains("sidebar-hidden"));
});

/* =========================
   BUSINESS DETAILS
========================= */

document.getElementById("businessName").addEventListener("input", (event) => {
  state.businessName = event.target.value;

  saveState();
  renderBusinessHeader();
});

document
  .getElementById("accountingPeriod")
  .addEventListener("input", (event) => {
    state.accountingPeriod = event.target.value;

    saveState();
    renderBusinessHeader();
  });

/* =========================
   PRINT
========================= */

document.getElementById("printCurrent").addEventListener("click", () => {
  closeMenu();

  const wasSidebarHidden = appShell.classList.contains("sidebar-hidden");

  appShell.classList.add("sidebar-hidden");

  const restoreSidebar = () => {
    if (!wasSidebarHidden) {
      appShell.classList.remove("sidebar-hidden");
    }

    window.removeEventListener("afterprint", restoreSidebar);
  };

  window.addEventListener("afterprint", restoreSidebar);

  window.print();
});

/* =========================
   PRINT ALL CURRENT SESSION
========================= */

function hasJournalData() {
  return state.journal.some((entry) => {
    return (
      entry.date.trim() ||
      entry.lf.trim() ||
      entry.narration?.trim() ||
      entry.lines.some(
        (line) => line.account.trim() || line.lf.trim() || line.amount.trim(),
      )
    );
  });
}

function hasLedgerData() {
  return state.ledgers.some((ledger) => {
    return (
      ledger.name.trim() ||
      ledger.debit.some(
        (row) =>
          row.date.trim() ||
          row.particulars.trim() ||
          row.jf.trim() ||
          row.amount.trim(),
      ) ||
      ledger.credit.some(
        (row) =>
          row.date.trim() ||
          row.particulars.trim() ||
          row.jf.trim() ||
          row.amount.trim(),
      )
    );
  });
}

function hasTrialBalanceData() {
  return state.trialBalance.some(
    (row) =>
      row.account.trim() ||
      row.lf.trim() ||
      row.debit.trim() ||
      row.credit.trim(),
  );
}

function hasStatementData(statement) {
  return (
    statement.left.some((row) => row.particulars.trim() || row.amount.trim()) ||
    statement.right.some((row) => row.particulars.trim() || row.amount.trim())
  );
}

function getUsedSections() {
  const usedSections = [];

  if (hasJournalData()) {
    usedSections.push("journal");
  }

  if (hasLedgerData()) {
    usedSections.push("ledger");
  }

  if (hasTrialBalanceData()) {
    usedSections.push("trialBalance");
  }

  if (hasStatementData(state.trading)) {
    usedSections.push("trading");
  }

  if (hasStatementData(state.profitLoss)) {
    usedSections.push("profitLoss");
  }

  if (hasStatementData(state.balanceSheet)) {
    usedSections.push("balanceSheet");
  }

  return usedSections;
}

function printAllCurrentSession() {
  closeMenu();

  const usedSections = getUsedSections();

  if (!usedSections.length) {
    alert("There is no accounting data to print.");
    return;
  }

  const originalSection = state.activeSection;

  const wasSidebarHidden = appShell.classList.contains("sidebar-hidden");

  const originalContent = content.innerHTML;
  const originalTitle = sectionTitle.textContent;
  const originalDescription = sectionDescription.textContent;

  appShell.classList.add("sidebar-hidden");

  const printContainer = document.createElement("div");

  printContainer.id = "print-session-container";
  printContainer.className = "print-session-container";

  document.body.appendChild(printContainer);

  usedSections.forEach((section) => {
    state.activeSection = section;

    let html = "";

    if (section === "journal") {
      renderJournal();

      html = content.innerHTML;
    } else if (section === "ledger") {
      renderLedger();

      html = content.innerHTML;
    } else if (section === "trialBalance") {
      renderTrialBalance();

      html = content.innerHTML;
    } else if (section === "trading") {
      renderDoubleStatement("trading", "Trading Account");

      html = content.innerHTML;
    } else if (section === "profitLoss") {
      renderDoubleStatement("profitLoss", "Profit & Loss Account");

      html = content.innerHTML;
    } else if (section === "balanceSheet") {
      renderBalanceSheet();

      html = content.innerHTML;
    }

    const sectionWrapper = document.createElement("section");

    sectionWrapper.className = "print-session-section";
    sectionWrapper.dataset.section = section;

    sectionWrapper.innerHTML = `
      <div class="print-session-heading">
        <div class="print-business-name">
          ${esc(state.businessName || "Untitled Business")}
        </div>

        <div class="print-session-title">
          ${esc(sectionMeta[section].title)}
        </div>

        <div class="print-accounting-period">
          ${esc(state.accountingPeriod || "No accounting period")}
        </div>
      </div>

      ${html}
    `;

    printContainer.appendChild(sectionWrapper);
  });

  state.activeSection = originalSection;

  content.innerHTML = originalContent;
  sectionTitle.textContent = originalTitle;
  sectionDescription.textContent = originalDescription;

  window.addEventListener(
    "afterprint",
    () => {
      printContainer.remove();

      if (!wasSidebarHidden) {
        appShell.classList.remove("sidebar-hidden");
      }

      render();
    },
    { once: true },
  );

  window.print();
}

document
  .getElementById("printAllCurrentSession")
  .addEventListener("click", printAllCurrentSession);

/* =========================
   DELETE ALL
========================= */

document.getElementById("deleteAllData").addEventListener("click", () => {
  requestDelete(
    "Delete all accounting data?",
    "Every journal, ledger, row, business detail and statement entry will be removed. This action cannot be undone.",
    () => {
      // Reset application state
      state = clone(defaultState);

      // Remove saved accounting data
      localStorage.removeItem(STORAGE_KEY);

      // Keep sidebar preference untouched
      saveStatus.textContent = "Cleared";

      // Close any open menu
      closeMenu();

      // Immediately rebuild the current UI
      render();
    },
  );
});

/* =========================
   CONFIRM DIALOG
========================= */

document.getElementById("confirmCancel").addEventListener("click", () => {
  pendingConfirm = null;

  if (confirmDialog.open) {
    confirmDialog.close();
  }
});

document
  .getElementById("confirmProceed")
  .addEventListener("click", executeDelete);

confirmDialog.addEventListener("click", (event) => {
  if (event.target === confirmDialog) {
    pendingConfirm = null;
    confirmDialog.close();
  }
});

const mobileExperienceNotice = document.getElementById(
  "mobileExperienceNotice",
);

const mobileNoticeContinue = document.getElementById("mobileNoticeContinue");

const MOBILE_NOTICE_KEY = "ledgerDeskMobileNoticeSeen";

function shouldShowMobileNotice() {
  return (
    window.matchMedia("(max-width: 640px)").matches &&
    window.matchMedia("(orientation: portrait)").matches &&
    !sessionStorage.getItem(MOBILE_NOTICE_KEY)
  );
}

function closeMobileNotice() {
  mobileExperienceNotice.style.display = "none";

  sessionStorage.setItem(MOBILE_NOTICE_KEY, "true");
}

if (mobileExperienceNotice && mobileNoticeContinue) {
  if (!shouldShowMobileNotice()) {
    mobileExperienceNotice.style.display = "none";
  }

  mobileNoticeContinue.addEventListener("click", closeMobileNotice);
}

/* =========================
   INITIAL RENDER
========================= */

render();
