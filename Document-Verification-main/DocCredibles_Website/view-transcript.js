document.getElementById("viewBtn").onclick = function() {
    const selectedSemester = document.getElementById("semester").value;

    fetch('data.json')
    .then(response => response.json())
    .then(data => {
        document.getElementById("name").textContent = data.name;
        document.getElementById("fatherName").textContent = data.fatherName;
        document.getElementById("enrollment").textContent = data.enrollment;
        document.getElementById("cgpa").textContent = data.cgpa;

        const subjectsList = document.getElementById("subjects");
        subjectsList.innerHTML = '';
        const gpalist = document.getElementById("gpa");
        gpalist.innerHTML = '';

        data.subjects[selectedSemester].forEach(subject => {
            const li = document.createElement("li");
            li.textContent = subject;
            subjectsList.appendChild(li);
        })
        data.gpa[selectedSemester].forEach(gpa => {
            const li = document.createElement("li");
            li.textContent = gpa;
            gpalist.appendChild(li);
        });

        document.getElementById("transcript").style.display = "block";
    })
    .catch(error => {
        console.error('Error fetching transcript data:', error);
    });
};
