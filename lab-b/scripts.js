const todo = {
  storageKey: "todo-tasks",
  tasks: [],
  editingTaskId: null,
  elements: {
    list: document.querySelector("#todo-list"),
    form: document.querySelector("#todo-form"),
    titleInput: document.querySelector("#todo-title-input"),
    dueInput: document.querySelector("#todo-due-input"),
    searchInput: document.querySelector("#todo-search-input"),
    message: document.querySelector("#todo-message")
  },

  init() {
    this.loadTasks();
    this.elements.form.addEventListener("submit", (event) => this.addTask(event));
    this.elements.searchInput.addEventListener("input", () => {
      if (this.saveEditing()) {
        this.renderTasks();
      }
    });
    this.elements.list.addEventListener("click", (event) => this.handleListClick(event));
    document.addEventListener("click", (event) => {
      if (this.editingTaskId && !this.elements.list.contains(event.target)) {
        this.saveEditing();
      }
    });
    this.renderTasks();
  },

  loadTasks() {
    const storedTasks = localStorage.getItem(this.storageKey);
    if (!storedTasks) {
      this.tasks = [];
      return;
    }

    try {
      const parsedTasks = JSON.parse(storedTasks);
      const validTasks = Array.isArray(parsedTasks) && parsedTasks.every((task) =>
        task && typeof task.id === "string" &&
        typeof task.title === "string" &&
        (typeof task.dueDate === "string" || task.dueDate === "")
      );
      if (!validTasks) {
        throw new Error("Nieprawidłowy format zapisanych zadań.");
      }
      this.tasks = parsedTasks;
    } catch (error) {
      this.tasks = [];
      this.elements.message.textContent = `Nie udało się wczytać zapisanych zadań: ${error.message}`;
    }
  },

  saveTasks() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.tasks));
      this.elements.message.textContent = "";
    } catch (error) {
      this.elements.message.textContent = `Nie udało się zapisać zadań: ${error.message}`;
    }
  },

  addTask(event) {
    event.preventDefault();
    const title = this.elements.titleInput.value.trim();
    const dueDate = this.elements.dueInput.value;

    if (title.length < 3 || title.length > 255) {
      this.elements.message.textContent = "Treść zadania musi mieć od 3 do 255 znaków.";
      this.elements.titleInput.focus();
      return;
    }

    if (dueDate && new Date(dueDate).getTime() <= Date.now()) {
      this.elements.message.textContent = "Termin wykonania musi być datą z przyszłości.";
      this.elements.dueInput.focus();
      return;
    }

    this.tasks.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      dueDate
    });
    this.saveTasks();
    this.elements.form.reset();
    this.renderTasks();
    this.elements.titleInput.focus();
  },

  renderTasks() {
    const query = this.elements.searchInput.value.trim();
    const activeQuery = query.length >= 2 ? query : "";
    const normalizedQuery = activeQuery.toLocaleLowerCase();
    const visibleTasks = this.tasks.filter((task) =>
      task.title.toLocaleLowerCase().includes(normalizedQuery)
    );

    this.elements.list.replaceChildren();
    if (visibleTasks.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "empty-state";
      emptyItem.textContent = activeQuery
        ? "Brak pasujących zadań."
        : "Brak zadań. Dodaj pierwsze poniżej.";
      this.elements.list.append(emptyItem);
      return;
    }

    visibleTasks.forEach((task) => this.renderTask(task, activeQuery));
  },

  renderTask(task, query) {
    const item = document.createElement("li");
    item.className = "todo-item";
    item.dataset.taskId = task.id;

    const title = document.createElement("button");
    title.type = "button";
    title.className = "task-title";
    title.setAttribute("aria-label", `Edytuj zadanie: ${task.title}`);
    this.appendHighlightedTitle(title, task.title, query);
    item.append(title);

    if (task.dueDate) {
      const dueDate = document.createElement("time");
      dueDate.className = "task-due-date";
      dueDate.dateTime = task.dueDate;
      dueDate.textContent = new Date(task.dueDate).toLocaleString("pl-PL");
      item.append(dueDate);
    }

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-task";
    deleteButton.textContent = "Usuń";
    deleteButton.setAttribute("aria-label", `Usuń zadanie: ${task.title}`);
    item.append(deleteButton);
    this.elements.list.append(item);
  },

  appendHighlightedTitle(element, title, query) {
    if (!query) {
      element.textContent = title;
      return;
    }

    const normalizedTitle = title.toLocaleLowerCase();
    const normalizedQuery = query.toLocaleLowerCase();
    let searchFrom = 0;
    let matchIndex = normalizedTitle.indexOf(normalizedQuery, searchFrom);

    while (matchIndex !== -1) {
      element.append(document.createTextNode(title.slice(searchFrom, matchIndex)));
      const highlightedText = document.createElement("mark");
      highlightedText.textContent = title.slice(matchIndex, matchIndex + query.length);
      element.append(highlightedText);
      searchFrom = matchIndex + query.length;
      matchIndex = normalizedTitle.indexOf(normalizedQuery, searchFrom);
    }
    element.append(document.createTextNode(title.slice(searchFrom)));
  },

  handleListClick(event) {
    let item = event.target.closest(".todo-item");
    if (!item) {
      return;
    }

    const taskId = item.dataset.taskId;
    if (this.editingTaskId && this.editingTaskId !== taskId) {
      if (!this.saveEditing()) {
        return;
      }
      item = this.elements.list.querySelector(`[data-task-id="${taskId}"]`);
      if (!item) {
        return;
      }
    } else if (this.editingTaskId === taskId) {
      return;
    }

    const task = this.tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }

    if (event.target.closest(".delete-task")) {
      this.tasks = this.tasks.filter((entry) => entry.id !== task.id);
      this.saveTasks();
      this.renderTasks();
      return;
    }

    this.startEditing(item, task);
  },

  startEditing(item, task) {
    const form = document.createElement("form");
    form.className = "task-edit-form";
    form.addEventListener("submit", (event) => this.saveEditing(event));

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.minLength = 3;
    titleInput.maxLength = 255;
    titleInput.required = true;
    titleInput.className = "task-edit-input";
    titleInput.value = task.title;
    titleInput.setAttribute("aria-label", "Edytuj treść zadania");
    form.append(titleInput);

    const dueInput = document.createElement("input");
    dueInput.type = "datetime-local";
    dueInput.className = "task-edit-due-input";
    dueInput.value = task.dueDate;
    dueInput.setAttribute("aria-label", "Edytuj termin wykonania");
    form.append(dueInput);

    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = "save-task";
    saveButton.textContent = "Zapisz";
    form.append(saveButton);

    item.replaceChildren(form);
    this.editingTaskId = task.id;
    titleInput.focus();
    titleInput.select();
  },

  saveEditing(event) {
    if (event) {
      event.preventDefault();
    }
    if (!this.editingTaskId) {
      return true;
    }

    const form = this.elements.list.querySelector(".task-edit-form");
    const task = this.tasks.find((entry) => entry.id === this.editingTaskId);
    if (!form || !task) {
      this.editingTaskId = null;
      return true;
    }

    const title = form.querySelector(".task-edit-input").value.trim();
    const dueDate = form.querySelector(".task-edit-due-input").value;
    if (title.length < 3 || title.length > 255) {
      this.elements.message.textContent = "Treść zadania musi mieć od 3 do 255 znaków.";
      form.querySelector(".task-edit-input").focus();
      return false;
    }
    if (dueDate && new Date(dueDate).getTime() <= Date.now()) {
      this.elements.message.textContent = "Termin wykonania musi być datą z przyszłości.";
      form.querySelector(".task-edit-due-input").focus();
      return false;
    }

    task.title = title;
    task.dueDate = dueDate;
    this.editingTaskId = null;
    this.saveTasks();
    this.renderTasks();
    return true;
  }
};

todo.init();
