//npm install --save untis-api

const { google } = require("googleapis");

const envFile = require("dotenv").config();
const w = require("untis-api");
const e = w.entities;
TimeTableEntity = require("untis-api").Entities.TimeTableEntity;
let CREDENTIALS = require("./credentials.json");
const CALENDAR_ID = process.env.CALENDAR_ID;
console.log(CALENDAR_ID);
const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const calendar = google.calendar({
  version: "v3",
});

console.log(CREDENTIALS);

const auth = new google.auth.JWT(
  CREDENTIALS.client_email,
  null,
  CREDENTIALS.private_key,
  SCOPES
);

conn();

async function conn() {
  await w.connect(
    process.env.user,
    process.env.password,
    process.env.school,
    process.env.server
  );
  deleteAllCalenderEntries();
  let classId = await getClassIdByClassName("4AHITM");
  let timeTable = await getTimetableFromClass(classId);
  timeTable = sortTimeTableByDateAndTime(timeTable);
  timeTable = filterForClass(timeTable, "4AHITM");
  console.table(timeTable);
  addEventsToGoogleCalender(timeTable);
  console.log("done");
}

function addEventsToGoogleCalender(timeTable) {
  timeTable.forEach((elem, index) => {
    console.log(elem);
    const event = {
      summary: elem.subject,
      description: `Lehrer:\n${getTeacherNamesOfArray(elem.teacher)}\nRaum: ${
        elem.room
      }`,
      start: {
        dateTime: combineDateAndTime(elem.date, elem.startTime),
        timeZone: "Europe/Berlin",
      },
      end: {
        dateTime: combineDateAndTime(elem.date, elem.endTime),
        timeZone: "Europe/Berlin",
      },
      location: "HTBLA Leonding",
    };

    setTimeout(() => {
      calendar.events.insert(
        {
          auth: auth,
          calendarId: CALENDAR_ID,
          resource: event,
        },
        function (err, event) {
          if (err) {
            console.log(
              "There was an error contacting the Calendar service: " + err
            );
            return;
          }
        }
      );
    }, 700 * index);
  });
}

function deleteAllCalenderEntries() {
  calendar.events.list(
    {
      auth: auth,
      calendarId: CALENDAR_ID,
      timeMin: new Date("2000-01-01T00:00:00.000Z").toISOString(),
      maxResults: 1000,
      singleEvents: true,
      orderBy: "startTime",
    },
    function (err, response) {
      if (err) {
        console.log(
          "There was an error contacting the Calendar service: " + err
        );
        return;
      }
      let events = response.data.items;
      if (events.length == 0) {
        console.log("No upcoming events found.");
      } else {
        for (let i = 0; i < events.length; i++) {
          let event = events[i];
          let start = event.start.dateTime || event.start.date;
          setTimeout(() => {
            calendar.events.delete(
              {
                auth: auth,
                calendarId: CALENDAR_ID,
                eventId: event.id,
              },
              function (err, response) {
                if (err) {
                  console.log(
                    "There was an error contacting the Calendar service: " + err
                  );
                  return;
                }
                console.log("Event deleted");
              }
            );
          }, 700 * i);
        }
      }
    }
  );
}

function getTeacherNamesOfArray(teachers) {
  let teacherNames = [];
  for (let i = 0; i < teachers.length; i++) {
    teacherNames.push(
      `${teachers[i].name} - ${teachers[i].foreName} ${teachers[i].longName}\n`
    );
  }
  return teacherNames;
}

function combineDateAndTime(date, time) {
  let dateTime = new Date(date);
  let timeArray = time.split(":");
  dateTime.setHours(timeArray[0]);
  dateTime.setMinutes(timeArray[1]);
  return dateTime;
}

function filterForClass(timeTable, className) {
  return timeTable.filter((elem) => elem.classname == className);
}

function sortTimeTableByDateAndTime(timeTable) {
  timeTable.forEach((elem) => {
    elem.date = new Date(
      +elem.date.substring(0, 4),
      +elem.date.substring(5, 7) - 1,
      +elem.date.substring(8, 10),
      +elem.startTime.substring(0, 2) + 2,
      +elem.startTime.substring(3, 5)
    );
  });

  //sort by day and by time
  timeTable.sort((a, b) => {
    if (a.date.getDay() == b.date.getDay()) {
      // sort date by hours and minutes
      if (a.date.getHours() == b.date.getHours()) {
        return a.date.getMinutes() - b.date.getMinutes();
      } else {
        return a.date.getHours() - b.date.getHours();
      }
    } else {
      return a.date.getDay() - b.date.getDay();
    }
  });
  return timeTable;
}

async function getClassIdByClassName(className) {
  let classes = await w.getClasses();
  let classId = classes.filter((c) => c.name == className);
  return classId[0].id;
}

async function getTimetableFromClass(classId) {
  let infoArr = [];
  let getTimetableData = await w.getTimetable(new TimeTableEntity(classId, 1));
  let lessons = getTimetableData;
  let allClasses = await w.getClasses();
  let getTeachersData = await w.getTeachers();
  let getSubjectsData = await w.getSubjects();
  let getRoomsData = await w.getRooms();
  for (const lesson of lessons) {
    infoArr.push({
      id: lesson.id,
      date: getDate(lesson.date),
      startTime: getTime(lesson.startTime + ""),
      endTime: getTime(lesson.endTime + ""),
      classname: await getClassNameById(allClasses, lesson.kl),
      teacher: await getTeacherNameById(getTeachersData, lesson.te),
      subject: getSubjectsData.filter(
        (suData) => suData.id == lesson.su[0].id
      )[0].name,
      room: getRoomsData.filter((room) => room.id == lesson.ro[0].id)[0].name,
    });
  }
  return infoArr;
}

async function getTeacherNameById(allTeachers, teachers) {
  teachers = teachers.map((t) => t.id);
  let teacherNames = allTeachers
    .filter((t) => teachers.includes(t.id))
    .map((t) => {
      const { id, title, active, dids, ...rest } = t;
      return rest;
    });
  return teacherNames;
}

async function getClassNameById(allClasses, classes) {
  classes = classes.map((c) => c.id);
  let className = allClasses
    .filter((c) => classes.includes(c.id))
    .map((c) => c.name);
  return className;
}

function getTime(time) {
  time = time.length == 3 ? "0" + time : time;
  return `${time.substring(0, 2)}:${time.substring(2, 4)}`;
}

function getDate(date) {
  date = date.toString();
  let year = date.substring(0, 4);
  let month = date.substring(4, 6);
  let day = date.substring(6, 8);
  return `${year}-${month}-${day}`;
}
