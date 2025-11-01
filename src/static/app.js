document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message and reset select
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // Build participants markup
        let participantsMarkup = "";
        if (Array.isArray(details.participants) && details.participants.length > 0) {
            const items = details.participants
              .map((p) => {
                // derive email/display name and initials from an email or object
                const emailVal = typeof p === "string" ? p : (p.email || p.name || String(p));
                const display = typeof p === "string" ? p : (p.name || p.email || String(p));
                const label = display.split("@")[0]; // show prefix of email if email
                const initials = label
                  .split(/[._\s-]+/)
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                // Include a delete button with data attributes
                return `
                  <li>
                    <span class="avatar">${initials}</span>
                    <span class="participant-name">${display}</span>
                    <button class="delete-btn" data-email="${emailVal}" aria-label="Remove participant">✖</button>
                  </li>
                `;
              })
              .join("");

            participantsMarkup = `
              <div class="participants">
                <strong>Participants</strong>
                <ul>
                  ${items}
                </ul>
              </div>
            `;
          } else {
          participantsMarkup = `
            <div class="participants">
              <strong>Participants</strong>
              <div class="empty">No participants yet — be the first!</div>
            </div>
          `;
        }

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          ${participantsMarkup}
        `;

        activitiesList.appendChild(activityCard);

        // Add delegated click handler for delete buttons on this activity card
        activityCard.addEventListener("click", async (e) => {
          const btn = e.target.closest(".delete-btn");
          if (!btn) return;
          const email = btn.getAttribute("data-email");
          if (!email) return;

          // confirm before deleting
          const confirmed = window.confirm(`Remove ${email} from ${name}?`);
          if (!confirmed) return;

          try {
            const resp = await fetch(`/activities/${encodeURIComponent(name)}/participants?email=${encodeURIComponent(email)}`, {
              method: "DELETE",
            });

            const result = await resp.json();
            if (resp.ok) {
              messageDiv.textContent = result.message || "Participant removed";
              messageDiv.className = "success";
              messageDiv.classList.remove("hidden");
              // refresh list
              await fetchActivities();
            } else {
              messageDiv.textContent = result.detail || "Could not remove participant";
              messageDiv.className = "error";
              messageDiv.classList.remove("hidden");
            }
            setTimeout(() => messageDiv.classList.add("hidden"), 4000);
          } catch (err) {
            console.error("Error removing participant:", err);
            messageDiv.textContent = "Network error while removing participant";
            messageDiv.className = "error";
            messageDiv.classList.remove("hidden");
            setTimeout(() => messageDiv.classList.add("hidden"), 4000);
          }
        });

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Optimistically update the UI so users see the new participant immediately
        try {
          addParticipantToDOM(activity, email);
        } catch (err) {
          console.error('Failed to optimistically add participant to DOM', err);
        }

        // Refresh activities so participants list updates
        // call refresh but don't block the UI if it fails
        fetchActivities().catch((err) => console.error('Failed to refresh activities:', err));
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Helper: add a participant row into the corresponding activity card
  function addParticipantToDOM(activityName, email) {
    // find the matching activity card by its h4 title
    const cards = activitiesList.querySelectorAll('.activity-card');
    let targetCard = null;
    for (const c of cards) {
      const h4 = c.querySelector('h4');
      if (h4 && h4.textContent.trim() === activityName) {
        targetCard = c;
        break;
      }
    }
    if (!targetCard) return; // nothing to do

    const participantsDiv = targetCard.querySelector('.participants');
    if (!participantsDiv) {
      // create participants container
      const container = document.createElement('div');
      container.className = 'participants';
      const strong = document.createElement('strong');
      strong.textContent = 'Participants';
      container.appendChild(strong);
      const ul = document.createElement('ul');
      container.appendChild(ul);
      targetCard.appendChild(container);
      // proceed to append
      insertParticipantLi(ul, email);
      return;
    }

    // if there was an empty hint, replace it with a ul
    const emptyHint = participantsDiv.querySelector('.empty');
    if (emptyHint) {
      emptyHint.remove();
      const ul = document.createElement('ul');
      participantsDiv.appendChild(ul);
      insertParticipantLi(ul, email);
      return;
    }

    const ul = participantsDiv.querySelector('ul');
    if (!ul) {
      const newUl = document.createElement('ul');
      participantsDiv.appendChild(newUl);
      insertParticipantLi(newUl, email);
      return;
    }

    insertParticipantLi(ul, email);
  }

  function insertParticipantLi(ul, email) {
    const li = document.createElement('li');

    const initialsLabel = (email.split('@')[0] || '').split(/[._\s-]+/).map(s => s[0] || '').slice(0,2).join('').toUpperCase();

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = initialsLabel;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'participant-name';
    nameSpan.textContent = email;

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.setAttribute('data-email', email);
    del.setAttribute('aria-label', 'Remove participant');
    del.textContent = '✖';

    li.appendChild(avatar);
    li.appendChild(nameSpan);
    li.appendChild(del);

    ul.appendChild(li);
  }

  // Initialize app
  fetchActivities();
});
