# **Collaboration Guidelines**

## 🪬 Core Collaboration Rules

1. **Never commit directly to your `local main` but ensure it is alawys ensync with the `remote main`.**
2. **Always create a feature branch** for your work.
3. **Name your branch using your first name and the approved requirement ID** (e.g., `arnel/fr-01`).
4. Write **clear PR descriptions**. Explain what changed, why, and how to test it.
5. **All changes must be submitted via a Pull Request (PR).**
6. **At least one peer review is required** before approval.
7. **Only the designated checker may merge PRs into `main`.**
8. **Announce your PR in the group chat** once it’s ready for review.
9. **Test your changes thoroughly** and include **manual testing evidence** in your PR.
10. **Resolve all known issues on your end before submitting your PR**, not after.
11. **Respect deadlines and communicate early**. If you’re blocked or delayed, inform the team as soon as possible.
12. **Ask questions if anything is unclear**—collaboration is highly encouraged.

To ensure smooth collaboration and maintain code quality, follow these instructions strictly:

---

### **1️⃣ Never commit directly to `main`**

- Your local `main` branch **must always stay in sync** with the remote repository (`origin/main`).
- Before starting work, update your local `main`:

```bash
git checkout main
git fetch origin
git rebase origin/main
# OR
git merge orgin/main
```

---

### **2️⃣ Create a feature branch**

- Each task or resource should have its own branch:

```bash
git checkout -b arnel/fr-02
```

---

### **3️⃣ Work on your feature**

- Implement **only what is described in the guided TODO instructions**.
- Avoid over-engineering; **excessive complexity may result in returning the work for revisions**.
- Provide **concise, meaningful comments only**. Detailed inline comments are discouraged; commit messages should be the primary documentation.

---

### **4️⃣ Commit your changes**

- Make **meaningful commits** with clear messages that explain what and why:

```bash
git add .
git commit -m "add this feature...."
```

- **Detailed commit messages are encouraged**, but avoid heavy inline comments in code.
- If your implementation deviates from the TODO without proper documentation in commits, your work may be returned for revision.

---

### **5️⃣ Sync with remote before submitting PR**

- Regularly update your feature branch with the latest `main` to avoid conflicts:

```bash
git fetch origin
git rebase origin/main
```

- Resolve any conflicts **locally** before submitting a PR.

---

### **6️⃣ Push feature branch & submit PR**

```bash
git push origin arnel/fr-02
```

- On GitHub, create a **Pull Request (PR)** targeting `main`.
- Clearly indicate the resource/task your PR addresses.
- Failure to address first your development environment issues (if you have) result in PR being returned for revisions.

---

### **7️⃣ Post-merge responsibilities**

- After your PR is merged, update your local main branch before starting a new task:

```bash
git checkout main
git fetch origin
git rebase origin/main
```

- Always stay in sync with `main` to prevent conflicts in future tasks.

---

### **8️⃣ Code Quality Reminders**

- **Do not over-engineer** solutions; simplicity and correctness are prioritized.
- **Use comments sparingly**: only where clarity is needed.
