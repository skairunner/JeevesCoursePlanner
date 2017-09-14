import * as utility from "./utility";

/**
 * This file is mostly data structures that store course-related information.
 */

/**
 * Stores times for classes, including a start time, end time, and day of week.
 */
export class CourseTime {
    /**Start time */
    starttime: utility.Time;
    /**End time */
    endtime: utility.Time;
    day: number;

    /**
     * Constructor for CourseTime
     * @param start Start time of class.
     * @param end End time of class.
     * @param day Day of week of class, as enumerated in [[DayFromInt]].
     */
    constructor(start: utility.Time, end: utility.Time, day: number) {
        this.starttime = start;
        this.endtime = end;
        this.day = day;
    }

    /**
     * Compare two CourseTimes and determine whether the two overlap.
     * eg, one from 10 to 12 overlaps with one from 11 to 13.
     * @param other The CourseTime to compare with.
     */
    overlaps(other:CourseTime) {
        if (this.day != other.day) {
            return false;
        }
        // Times overlap if (StartA < EndB) AND (StartB < EndA). Touching is not overlapping
        let condition1 = this.starttime.toMinutes() < other.endtime.toMinutes();
        let condition2 = other.starttime.toMinutes() < this.endtime.toMinutes();
        return condition1 && condition2
    }

    /**Return the day of week this class is on, but as a human-friendly name. */
    getDayName() {
        return utility.DayFromInt[this.day];
    }

    /**
     * returns the course's duration formatted as "hh:mm am ~ hh:mm pm"
     */
    formattedString() {
        var start = this.starttime;
        var end   = this.endtime;
        return start.toString() + "—" + end.toString(); // used to be "—" but because unicode is terrible.
    }
}

/**
 * [[CourseComponent]] is effectively a data structure that holds all the information
 * Albert has for each class section.
 */
export class CourseComponent {
    /**The section string. Sections are not necessarily numbers. */
    section: string;
    /**The course number is identical to the one used when adding classes to cart on Albert. */
    coursenumber: number;
    /**Includes types like "lecture", "seminar" or "recitation." */
    componentType: string;
    /**All the class times for this component. One CourseTime per day.*/
    classtimes: CourseTime[];
    /**Usually NYU Shanghai for NYUSH courses, and the school building for NYU courses. */
    location: string;
    /**How many units/credits does this component count as? Courses are usually 2-4 units, and 
     * recitations are usually 0 units.
     */
    units: number;
    /**The instructor of the component. May not exist. */
    instructor: string;
    /**The sub-title of the component. It is usually a full-blown title for
     * *Topics of X*-type classes.
     */
    topic: string;
    /**Notes for the course. It is often a full-blown course description
     * for *Topics of X*-type classes.
     */
    notes: string;

    /**
     * Construct a component.
     * @param jsonobj The jsonobj is an Object that contains the info for this course,
     * as output by the courseprocessor file.
     */
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
    /**Of all the class times in this component, find and return
     * the earliest start time.
     */
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

    /**Of all the class times in this component, find and return
     * the latest start time.
     */
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

/**
 * [[Course]] contains all the info on Albert for one course.
 * It has a list of components, each with their own set of info, 
 * as well as titles and descriptions for the entire course bloc.
 */
export class Course {
    /**The name of the course. Usually formatted something like USC-GA 2919*/
    name: string;
    /**The title of the course. Something like **Introduction to Psychology**. */
    title: string;
    /**The [[CourseComponents]] for this Course.*/
    components: CourseComponent[];
    //**The description of the class as provided on Albert. */
    desc: string;
    /**An index of words that appear in this Course, sanitized and deduplicated.
     * Used to facilitate searching.
     */
    searchable: string;
    /**The types of courses that exist. Eg, if a Course has both Lecture and Recitation
     * components, it is assumed that one most have both. 
     */
    requiredcomponents: string[];

    /**
     * @param jsonobj The jsonobj is an Object that contains the info for this course,
     * as output by the courseprocessor file.
     */
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

/**
 * Used to keep track of which courses have been selected by the user.
 * It stores a ref to the original Course and CourseComponent, as well
 * as the sectionid selected for convenience.
 */
export class SelectedCourse {
    /**Reference to selected course. */
    course:Course;
    /**The sectionid for the selected component. */
    sectionid:string;
    /**Reference to the [[CourseComponent]] selected. */
    component:CourseComponent;

    /**
     * Construct a [[SelectedCourse]].
     * @param course The Course selected.
     * @param sectionid The sectionid for the selected component.
     */
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

    /**Check if a given [[SelectedCourse]]'s contents are identical to this one.*/
    isEquivalent(other:SelectedCourse) {
        return this.component.coursenumber == other.component.coursenumber;
    }
}

/**
 * Keeps track of all courses.
 */
export class CourseCatalogue {
    /**Used as a dictionary of key `coursename` to value [[Course]].*/
    table: any;

    /**A flat list of all courses. */
    list: Course[];

    /**Initializes CourseCatalogue but does **not** fill in its contents. See `bulkAddCourses()`. */
    constructor() {
        this.table = {};
        this.list = [];
    }

    /**
     * Adds all courses via a large json file.
     * @param jsondata A json file emitted by courseprocessor.
     */
    bulkAddCourses(jsondata) {
        for (var coursename in jsondata) {
            var coursedata = new Course(jsondata[coursename]);
            this.table[coursename] = coursedata;
            this.list.push(coursedata);
        }
    }
}