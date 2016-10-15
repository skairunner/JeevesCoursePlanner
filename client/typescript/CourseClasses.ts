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

    overlaps(other:CourseTime) {
        if (this.day != other.day) {
            return false;
        }
        // Times overlap if (StartA < EndB) AND (StartB < EndA). Touching is not overlapping
        let condition1 = this.starttime.toMinutes() < other.endtime.toMinutes();
        let condition2 = other.starttime.toMinutes() < this.endtime.toMinutes();
        return condition1 && condition2
    }

    getDayName() {
        return utility.DayFromInt[this.day];
    }

    // returns the string "hh:mm am ~ hh:mm pm"
    formattedString() {
        var start = this.starttime;
        var end   = this.endtime;
        return start.toString() + "—" + end.toString(); // used to be "—" but because unicode is terrible.
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
        if ("units" in jsonobj) {
            this.units = parseInt(jsonobj.units);
        } else {
            this.units = 0;
        }
        
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

    getMinStartTime() {
        if (this.classtimes.length == 0) {
            return new utility.Time([9, 0]);
        }
        let minindex = 0;
        let minvalue = this.classtimes[0].starttime.toMinutes();
        for (let i = 1; i < this.classtimes.length; i++) {
            if (this.classtimes[i].starttime.toMinutes() < minvalue) {
                minindex = i;
                minvalue = this.classtimes[i].starttime.toMinutes(); 
            }
        }
        return this.classtimes[minindex].starttime;
    }

    getMaxEndTime() {
        if (this.classtimes.length == 0) {
            return new utility.Time([15, 0]);
        }
        let maxindex = 0;
        let maxvalue = this.classtimes[0].endtime.toMinutes();
        for (let i = 1; i < this.classtimes.length; i++) {
            if (maxvalue < this.classtimes[i].endtime.toMinutes()) {
                maxindex = i;
                maxvalue = this.classtimes[i].endtime.toMinutes(); 
            }
        }
        return this.classtimes[maxindex].endtime;
    }
}

export class Course {
    name: string;
    title: string;
    components: CourseComponent[];
    desc: string;
    searchable: string;
    requiredcomponents: string[];

    constructor(jsonobj: any) {
        this.name = jsonobj.name;
        this.title = jsonobj.title;
        this.desc = jsonobj.desc;
        this.components = [];
        for (var i = 0; i < jsonobj.components.length; i++) {
            this.components.push(new CourseComponent(jsonobj.components[i]));
        }
        this.searchable = jsonobj.searchable;
        this.requiredcomponents = jsonobj.requiredcomponents; 
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

    isEquivalent(other:SelectedCourse) {
        return this.component.coursenumber == other.component.coursenumber;
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