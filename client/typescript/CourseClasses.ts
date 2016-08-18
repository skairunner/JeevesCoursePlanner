import * as utility from "./utility";

export class CourseTime {
    starttime: utility.Time;
    endtime: utility.Time;
    day: number;

    constructor(start: utility.Time, end: utility.Time, day: number) {
        this.starttime = start;
        this.endtime = end;
        this.day = day;
    }
}

export class CourseComponent {
    section: string;
    coursenumber: number;
    componentType: string;
    classtimes: CourseTime[];
    location: string;
    units: number;
    instructor: string;
    topic: string;
    notes: string;

    constructor(jsonobj: any) {
        this.section = jsonobj.section;
        this.coursenumber = jsonobj["number"];
        this.componentType = jsonobj.componentType;
        this.location = jsonobj.location;
        if ("topic" in jsonobj) {
            this.topic = jsonobj.topic;
        } else {
            this.topic = "";
        }
        this.units = parseInt(jsonobj.units);
        this.instructor = jsonobj.instructor;
        this.notes = jsonobj.notes;
        this.classtimes = [];
        if (jsonobj.classtimes != undefined) {
            for (let i = 0; i < jsonobj.classtimes.length; i++) {
                let timeobj = jsonobj.classtimes[i];
                let start = new utility.Time(timeobj.starttime);
                let end = new utility.Time(timeobj.endtime);
                let day = parseInt(timeobj.day);
                this.classtimes.push(new CourseTime(start, end, timeobj.day));
            }
        }
    }
}

export class Course {
    name: string;
    title: string;
    components: CourseComponent[];
    desc: string;
    constructor(jsonobj: any) {
        this.name = jsonobj.name;
        this.title = jsonobj.title;
        this.desc = jsonobj.desc;
        this.components = [];
        for (var i = 0; i < jsonobj.components.length; i++) {
            this.components.push(new CourseComponent(jsonobj.components[i]));
        }
    }
}

export class SelectedCourse {
    course:Course;
    sectionid:string;
    component:CourseComponent;

    constructor(course:Course, sectionid:string) {
        this.course = course;
        this.sectionid = sectionid;
        for (let i = 0; i < this.course.components.length; i++) {
            if (this.course.components[i].section == sectionid) {
                this.component = this.course.components[i];
                break;
            }
        }

    }
}

export class CourseCatalogue {
    table: any;
    list: Course[];
    constructor() {
        this.table = {};
        this.list = [];
    }

    // add courses via json format
    bulkAddCourses(jsondata) {
        for (var coursename in jsondata) {
            var coursedata = new Course(jsondata[coursename]);
            this.table[coursename] = coursedata;
            this.list.push(coursedata);
        }
    }
}