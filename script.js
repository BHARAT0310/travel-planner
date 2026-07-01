import { 
  db, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy 
} from "./firebase.js";

// DOM Elements Selection
const eventForm = document.getElementById("eventForm");
const formTitle = document.getElementById("formTitle");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const eventIdInput = document.getElementById("eventId");
const eventTitleInput = document.getElementById("eventTitle");
const eventTypeSelect = document.getElementById("eventType");
const eventStatusSelect = document.getElementById("eventStatus");
const eventStartInput = document.getElementById("eventStart");
const eventEndInput = document.getElementById("eventEnd");
const eventLocationInput = document.getElementById("eventLocation");
const eventCostInput = document.getElementById("eventCost");
const eventNotesInput = document.getElementById("eventNotes");

const searchBar = document.getElementById("searchBar");
const filterType = document.getElementById("filterType");
const filterStatus = document.getElementById("filterStatus");

const timelineContent = document.getElementById("timelineContent");
const visibleCountBadge = document.getElementById("visibleCountBadge");
const totalCostDisplay = document.getElementById("totalCostDisplay");
const totalEventsDisplay = document.getElementById("totalEventsDisplay");

const themeToggleBtn = document.getElementById("themeToggleBtn");
const printReportBtn = document.getElementById("printReportBtn");
const printTimelineContent = document.getElementById("printTimelineContent");
const printTotalCost = document.getElementById("printTotalCost");
const printTotalEvents = document.getElementById("printTotalEvents");
const printGeneratedDate = document.getElementById("printGeneratedDate");

// State parameters
let eventsArray = [];
let currentEditId = null;

// Initialize theme state from browser localStorage
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark-mode");
  themeToggleBtn.innerHTML = `<i class="fa-solid fa-sun"></i>`;
} else {
  themeToggleBtn.innerHTML = `<i class="fa-solid fa-moon"></i>`;
}

// Bind Database Connection
const eventsCollection = collection(db, "events");
const orderedQuery = query(eventsCollection, orderBy("dateTimeStart", "asc"));

// Listen for Real-Time Firestore Updates
onSnapshot(orderedQuery, (snapshot) => {
  eventsArray = [];
  snapshot.forEach((docSnap) => {
    eventsArray.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });
  processAndRender();
}, (error) => {
  console.error("Firestore synchronisation failure: ", error);
});

// Calculate statistics and apply local client-side search/filters
function processAndRender() {
  const searchTerm = searchBar.value.toLowerCase().trim();
  const selectedType = filterType.value;
  const selectedStatus = filterStatus.value;

  // Filter events without querying Firestore unnecessarily (keeps load fast)
  const filteredEvents = eventsArray.filter(evt => {
    const matchesSearch = 
      evt.title.toLowerCase().includes(searchTerm) || 
      (evt.location && evt.location.toLowerCase().includes(searchTerm)) ||
      (evt.notes && evt.notes.toLowerCase().includes(searchTerm));
    
    const matchesType = selectedType === "all" || evt.type === selectedType;
    const matchesStatus = selectedStatus === "all" || evt.status === selectedStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate Aggregations
  const totalCost = eventsArray.reduce((acc, curr) => acc + (parseFloat(curr.cost) || 0), 0);
  const totalEventsCount = eventsArray.length;

  totalCostDisplay.textContent = `$${totalCost.toFixed(2)}`;
  totalEventsDisplay.textContent = totalEventsCount;
  visibleCountBadge.textContent = `Showing ${filteredEvents.length} of ${totalEventsCount} Events`;

  // Render UI Components
  renderTimeline(filteredEvents);
  preparePrintData(filteredEvents, totalCost);
}

// Generate the Dynamic Vertical Itinerary Timeline Grouped by Day
function renderTimeline(events) {
  if (events.length === 0) {
    timelineContent.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-route empty-icon"></i>
        <p>No trip details match your parameters.</p>
      </div>
    `;
    return;
  }

  // Group events sequentially by their Calendar Day (Local Time representation)
  const grouped = {};
  events.forEach(event => {
    const dateObj = new Date(event.dateTimeStart);
    const dayKey = dateObj.toLocaleDateString(undefined, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    if (!grouped[dayKey]) {
      grouped[dayKey] = [];
    }
    grouped[dayKey].push(event);
  });

  let htmlContent = "";

  for (const [day, dayEvents] of Object.entries(grouped)) {
    htmlContent += `
      <div class="day-group">
        <div class="day-header">
          <i class="fa-regular fa-calendar"></i> ${day}
        </div>
        <div class="timeline-items">
    `;

    dayEvents.forEach(evt => {
      const timeString = formatEventTimes(evt.dateTimeStart, evt.dateTimeEnd);
      const icon = getCategoryIcon(evt.type);
      const displayCost = evt.cost ? `$${parseFloat(evt.cost).toFixed(2)}` : "Free / Unspecified";
      
      const mapLink = evt.location 
        ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-map-pin"></i> ${evt.location}</a>` 
        : "";

      htmlContent += `
        <div class="timeline-item status-${evt.status}" id="card-${evt.id}">
          <div class="timeline-node">
            <i class="${icon}"></i>
          </div>
          
          <div class="item-meta">
            <span class="item-times">${timeString}</span>
            <div class="meta-badges">
              <span class="type-badge type-${evt.type}">${evt.type}</span>
              <span class="status-indicator ${evt.status === 'temporary' ? 'temp' : 'perm'}">
                ${evt.status === 'temporary' ? 'Tentative' : 'Confirmed'}
              </span>
            </div>
          </div>

          <h4 class="item-title">${evt.title}</h4>
          
          ${evt.location ? `<div class="item-location">${mapLink}</div>` : ""}
          ${evt.notes ? `<div class="item-notes">${escapeHTML(evt.notes)}</div>` : ""}

          <div class="item-footer">
            <span class="item-cost"><i class="fa-solid fa-coins"></i> ${displayCost}</span>
            <div class="item-actions">
              <button class="icon-btn edit-btn" data-id="${evt.id}" title="Edit Detail">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="icon-btn delete-btn" data-id="${evt.id}" title="Remove Detail">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    htmlContent += `
        </div>
      </div>
    `;
  }

  timelineContent.innerHTML = htmlContent;
  attachTimelineEventListeners();
}

// Prep data for custom print page
function preparePrintData(events, totalCost) {
  printTotalCost.textContent = `$${totalCost.toFixed(2)}`;
  printTotalEvents.textContent = eventsArray.length;
  printGeneratedDate.textContent = `Generated on: ${new Date().toLocaleDateString()} @ ${new Date().toLocaleTimeString()}`;

  if (events.length === 0) {
    printTimelineContent.innerHTML = "<p>No scheduled activities found in dynamic search filters.</p>";
    return;
  }

  // Mirror structured view representation for printed paper format
  const grouped = {};
  events.forEach(evt => {
    const dateObj = new Date(evt.dateTimeStart);
    const dayKey = dateObj.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!grouped[dayKey]) grouped[dayKey] = [];
    grouped[dayKey].push(evt);
  });

  let htmlContent = "";
  for (const [day, dayEvents] of Object.entries(grouped)) {
    htmlContent += `
      <div class="print-day-group">
        <div class="print-day-title">${day}</div>
    `;

    dayEvents.forEach(evt => {
      const timeString = formatEventTimes(evt.dateTimeStart, evt.dateTimeEnd);
      const costValue = evt.cost ? `$${parseFloat(evt.cost).toFixed(2)}` : "None";
      htmlContent += `
        <div class="print-item">
          <div class="print-item-header">
            <span>${evt.title} [${evt.type.toUpperCase()}]</span>
            <span>${timeString}</span>
          </div>
          <div class="print-meta">
            <strong>Status:</strong> ${evt.status.toUpperCase()} | 
            <strong>Cost:</strong> ${costValue} 
            ${evt.location ? `| <strong>Location:</strong> ${evt.location}` : ""}
          </div>
          ${evt.notes ? `<div class="print-notes"><strong>Notes:</strong> ${escapeHTML(evt.notes)}</div>` : ""}
        </div>
      `;
    });
    htmlContent += `</div>`;
  }
  printTimelineContent.innerHTML = htmlContent;
}

// Handle Form Submission: Create and Update Records
eventForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = eventTitleInput.value.trim();
  const type = eventTypeSelect.value;
  const status = eventStatusSelect.value;
  const dateTimeStart = eventStartInput.value;
  const dateTimeEnd = eventEndInput.value;
  const location = eventLocationInput.value.trim();
  const cost = parseFloat(eventCostInput.value) || 0;
  const notes = eventNotesInput.value.trim();

  // Basic Validation Checks
  if (!title || !dateTimeStart) {
    alert("Please complete all required fields (*)");
    return;
  }

  const payload = {
    title,
    type,
    status,
    dateTimeStart,
    dateTimeEnd: dateTimeEnd || null,
    location: location || null,
    cost: cost >= 0 ? cost : 0,
    notes: notes || null,
    updatedAt: new Date().toISOString()
  };

  try {
    if (currentEditId) {
      // Update target document
      const docRef = doc(db, "events", currentEditId);
      await updateDoc(docRef, payload);
      resetFormState();
    } else {
      // Create novel record
      await addDoc(eventsCollection, payload);
      eventForm.reset();
    }
  } catch (error) {
    console.error("Database submission error: ", error);
    alert("Failed to submit record to the cloud. Verify security configurations.");
  }
});

// Setup dynamic action binds (Edit/Delete) on items
function attachTimelineEventListeners() {
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-id");
      initiateEdit(targetId);
    });
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-id");
      initiateDelete(targetId);
    });
  });
}

// Transition application form state into Editing view mode
function initiateEdit(id) {
  const match = eventsArray.find(evt => evt.id === id);
  if (!match) return;

  currentEditId = id;
  eventIdInput.value = match.id;
  eventTitleInput.value = match.title;
  eventTypeSelect.value = match.type;
  eventStatusSelect.value = match.status;
  eventStartInput.value = match.dateTimeStart;
  eventEndInput.value = match.dateTimeEnd || "";
  eventLocationInput.value = match.location || "";
  eventCostInput.value = match.cost || "";
  eventNotesInput.value = match.notes || "";

  formTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Event`;
  submitBtn.textContent = "Save Changes";
  cancelEditBtn.classList.remove("hidden");

  // Smooth slide back to edit dashboard pane
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Discard Edit State and clear inputs
cancelEditBtn.addEventListener("click", resetFormState);

function resetFormState() {
  currentEditId = null;
  eventForm.reset();
  formTitle.innerHTML = `<i class="fa-solid fa-calendar-plus"></i> Add Trip Event`;
  submitBtn.textContent = "Add Event";
  cancelEditBtn.classList.add("hidden");
}

// Delete Database records
async function initiateDelete(id) {
  if (confirm("Are you sure you want to permanently remove this event from your itinerary?")) {
    try {
      const docRef = doc(db, "events", id);
      await deleteDoc(docRef);
      if (currentEditId === id) resetFormState();
    } catch (error) {
      console.error("Failed deletion request: ", error);
      alert("Database error deleting the item.");
    }
  }
}

// Search and Filter Input Triggers
searchBar.addEventListener("input", processAndRender);
filterType.addEventListener("change", processAndRender);
filterStatus.addEventListener("change", processAndRender);

// Dark Mode Toggle Logic
themeToggleBtn.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark-mode");
  if (isDark) {
    localStorage.setItem("theme", "dark");
    themeToggleBtn.innerHTML = `<i class="fa-solid fa-sun"></i>`;
  } else {
    localStorage.setItem("theme", "light");
    themeToggleBtn.innerHTML = `<i class="fa-solid fa-moon"></i>`;
  }
});

// Trigger browser native print layouts
printReportBtn.addEventListener("click", () => {
  window.print();
});

// Helper formatting utilities
function formatEventTimes(startIso, endIso) {
  const start = new Date(startIso);
  const startTimeStr = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  
  if (endIso) {
    const end = new Date(endIso);
    const endTimeStr = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    
    // Evaluate if dates span multi-day
    if (start.toDateString() !== end.toDateString()) {
      const endSimpleDate = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `${startTimeStr} - ${endSimpleDate}, ${endTimeStr}`;
    }
    return `${startTimeStr} - ${endTimeStr}`;
  }
  return startTimeStr;
}

function getCategoryIcon(type) {
  switch (type) {
    case 'flight': return 'fa-solid fa-plane';
    case 'lodging': return 'fa-solid fa-bed';
    case 'activity': return 'fa-solid fa-binoculars';
    case 'food': return 'fa-solid fa-utensils';
    case 'transit': return 'fa-solid fa-train-subway';
    default: return 'fa-solid fa-circle-info';
  }
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}