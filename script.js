// Smart Canteen Queue
// 35% Prototype


// Queue array

let queue = [];


// Student's token

let myToken = null;


// Update the dashboard

function updateQueue() {

    // Number of people

    document.getElementById("queueCount").innerText =
        queue.length;


    // Each person takes approximately 3 minutes

    let waitingTime = queue.length * 3;

    document.getElementById("waitTime").innerText =
        waitingTime;


    // Crowd status

    let crowd = document.getElementById("crowdStatus");


    if (queue.length <= 3) {

        crowd.innerText = "Low 🟢";

    }

    else if (queue.length <= 7) {

        crowd.innerText = "Medium 🟡";

    }

    else {

        crowd.innerText = "High 🔴";

    }


    displayQueue();

}


// Join queue

function joinQueue() {

    // Prevent same student from joining twice

    if (myToken !== null) {

        showStudentStatus();

        return;

    }


    // Create token

    let token =
        queue.length + 1;


    // Add student

    queue.push(token);


    // Store student's token

    myToken = token;


    updateQueue();

    showStudentStatus();

}


// Show student's position

function showStudentStatus() {

    if (myToken === null) {

        return;

    }


    // Find position

    let position =
        queue.indexOf(myToken);


    let status =
        document.getElementById("studentStatus");


    if (position === -1) {

        status.innerHTML =
            "Your token has been served.";

        myToken = null;

        return;

    }


    let actualPosition =
        position + 1;


    let waitingTime =
        position * 3;


    status.innerHTML =

        "🎫 Your Token: <strong>" +
        myToken +
        "</strong><br>" +

        "📍 Your Position: <strong>" +
        actualPosition +
        "</strong><br>" +

        "⏱️ Estimated Wait: <strong>" +
        waitingTime +
        " minutes</strong>";

}


// Display queue

function displayQueue() {

    let list =
        document.getElementById("queueList");


    list.innerHTML = "";


    if (queue.length === 0) {

        list.innerHTML =
            "<p style='text-align:center'>" +
            "Queue is empty" +
            "</p>";

        return;

    }


    queue.forEach(
        function(token, index) {

            let item =
                document.createElement("div");


            item.className =
                "queue-item";


            item.innerHTML =

                "<span>🎫 Token " +
                token +
                "</span>" +

                "<span>Position " +
                (index + 1) +
                "</span>";


            list.appendChild(item);

        }
    );

}


// Staff serves next student

function serveNext() {

    if (queue.length === 0) {

        alert("Queue is empty!");

        return;

    }


    let servedToken =
        queue.shift();


    alert(
        "Token " +
        servedToken +
        " has been served!"
    );


    // Check if it was our token

    if (servedToken === myToken) {

        myToken = null;

    }


    updateQueue();

    showStudentStatus();

}


// Reset queue

function resetQueue() {

    queue = [];

    myToken = null;


    updateQueue();


    document.getElementById(
        "studentStatus"
    ).innerHTML = "";


    alert(
        "Queue has been reset!"
    );

}


// Scroll to queue

function goToQueue() {

    document.getElementById(
        "queue"
    ).scrollIntoView({
        behavior: "smooth"
    });

}


// Start the page

updateQueue();