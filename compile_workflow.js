
/*
Set of predefined functions
predefined functions both define the gui blocks
and this compilation, so the functions are loaded in the editor

as well as functions, some substititions are allowed
a call is either substitution or function;
substitutions may have prerequisite functions; but not prerequisite substitutions (?)
substitutions could uncoupling language specific structures
and replace special cases of the compiler engine
like conditionals and possibly function definition

A stack of defined vars (store) is also maintained
*/

let predefined_functions = {},
    predefined_replacements = {};

// Collection: a class of data {name:value, name2:value2}

const Collection = {

   init: function() {
      this.list = {};
      return this;
   },

   clear: function() {
      this.list={};
      return this;
   },

   empty: function() {
      return (this.size() == 0);
   },

   contains: function(lbl) {
      return this.list[lbl] != undefined;
   },

   add: function (lbl,e) {
      if (this.contains(lbl))
         return false;
      this.list[lbl] = e;
      return this;
   },

   set: function (lbl,e) {
      this.list[lbl] = e;
      return this;
   },

   get: function(lbl) {
      return this.list[lbl];
   },

   remove: function (lbl) {
      if (this.contains(lbl)) {
         delete this.list[lbl];
         return this;
      } else {
         return false;
      }
   },

   removeAll: function (lbls) {
      return lbls.map(this.remove);
   },

   size: function() {
      return Object.keys(this.list).length;
   },

   map: function(f) {
      return this.list.map(f);
   }

}

// String with the resulting code
// plus simple encapsulated functions

const CodeString = {
   nl: "\n",
   tabbing: 3,

<<<<<<< .mine
   init: function() {
      this.text = "";
      this.level = 0;
      this.lineHead = "";
      return this;
   },
   clear: function() {
      this.text = "";
      this.level = 0;
      return this;
   },
   line: function(lin) {
      this.text += this.lineHead + lin + this.nl;
      return this;
   },
   skip: function() {
      this.text += this.nl;
      return this;
   },
   nest: function() {
      this.level++;
      this.lineHead = " ".repeat(this.tabbing*this.level);
      return this;
   },
   denest: function() {
      if (this.level>0)
           this.level--
      else
         this.level=0;
      this.lineHead = " ".repeat(this.tabbing*this.level);
      return this;
   },
   getLines: function() {
      return this.text.split(this.nl);
   },
   insertCode: function(code) {
      const c = code.getLines();
      c.map((l) => this.line(l));
      return this;
   }
=======
   init: function() {
      this.text = "";
      this.level = 0;
      this.lineHead = "";
      return this;
   },
   clear: function() {
      this.text = "";
      this.level = 0;
      return this;
   },
   line: function(lin) {
      this.text += this.lineHead + lin + this.nl;
      return this;
   },
   skip: function() {
      this.text += this.nl;
      return this;
   },
   nest: function() {
      this.level++;
      this.lineHead = " ".repeat(this.tabbing*this.level);
      return this;
   },
   denest: function() {
      if (this.level>0)
   	     this.level--
	   else
         this.level=0;
      this.lineHead = " ".repeat(this.tabbing*this.level);
      return this;
   },
   getLines: function() {
      return this.text.split(this.nl);
   },
   insertCode: function(code) {
      const c = code.getLines();
      c.map((l) => this.line(l));
      return this;
   }
}

const globalCode = Object.create(CodeString).init();

// list of functions in use (to not repeat them)
// this is the "d-list" of defined functions in LISP interpreters
const FunctionsCollection = {

   init: function() {
       this.list = [];
      return this;
    },
    clear: function() {
        this.list=[];
        return this;
    },
    notContain: function(F) {
        return this.list.indexOf(F) === -1;
    },
    add: function (F) {
        this.list.push(F);
        return this;
    }
}

const includedFunctions = Object.create(FunctionsCollection).init();

/* list of tokens (variables) in use, to parse them
   with encapsulated functions for handling the list
   list of substitutions already parsed */
const readyReplacements = {
    list: [],
    clear: function() {
        readyReplacements.list=[];
        return readyReplacements;
    },
    contain: function(X) {
        return readyReplacements.list.indexOf[X] >= 0;
    },
    set: function (X,R) {
        readyReplacements.list[X] = R;
        return readyReplacements;
    },
    get: function (X) {
        if (readyReplacements.contain(X))
            return readyReplacements[X];
        else
            return false;
    }
}

/*
The "process" needs improvemet
Need a wrapper object that limits the scope of needed functions
secures the execution and provides support e.g. display, timing, execution journal
*/
function compile(Exp) {
   includedFunctions.clear();
   tokens.clear();
   readyReplacements.clear();
   globalCode.clear();
   globalCode.line("// Automatically generated code");
   globalCode.skip();
   const call = encode(Exp,globalCode);
   globalCode.line("function pipe() {");
   globalCode.nest();
   globalCode.line("return "+call+";");
   globalCode.denest();
   globalCode.line("}");
   return globalCode.text;
}

function encode(Exp,vars) {
    let res;

    if (isArray(Exp)) {
    // cases 1 to 6 - Exp is an array
        res = encodeArray(Exp,vars);
    }
    else if (isString(Exp)) {
    // case 7: expression is a known variable
        if (tokens.contains(Exp)) res = Exp;
    // case 8: expression is a string
        else res = '"'+Exp+'"';
    }
    // case 9: expression is anything else - left unprocessed - works for number, boolean, null
    else res = Exp;

    // done
    return res;
}

function encodeArray(Exp, vars) {

    let res = null;
    // case 1: expression is an empty array
    if (Exp.length==0)
        res = '[]';
    else
    // Cases 2-6: non-empty array
    {
        let H = Exp[0]; // take the head
        let choice = caseOfHead(H);

        if (choice==2)
        //  case 2: Exp is a data array
            res = '['+encodeEach(Exp,vars)+']';
        else
        {
            Exp.shift(); // keep all but the head

        // case 3: expression is a function definition
            if (choice==3) {
                globalCode.line(defun(Exp[0],Exp[1],Exp[2]));
                globalCode.skip();
                res = encode(Exp[3],vars);
            }
        // case 3.5: (yeah, well...) expression is a lambda-expression
            if (choice==3.5) {
                res = lambda(Exp[0],Exp[1]);
            }
        // case 4: expression is a variable setting
            else if (choice==4) {
                let tok = Exp[0];
                tokens.stack(tok);
                res = tok;
                vars.line("let "+tok+" = "+encode(Exp[1])+";");
            }
        // case 4.2:  expression results in a block (function or replacement)
            else if (choice==4.2) { // [block,H]
                H = Exp[0]; // block name
                debugMsg(Exp, "is block", H);
                enforce(H, isString); // must be a string: it's a function call (!)
                if ((H in predefined_functions) || tokens.contains(H)) { //    si H est une fonction
                    getOperator(H); //      -- ajouter H aux fonctions en usage
                    res = H;
                }
                else if (H in predefined_replacements) { //    si x est un remplacement
                    // -- ajouter x = (arg1, ...) => (...) -- exemple plus = (a,b) => (a+b);
                    debugMsg(H,"is predefined, ");
                    res = getSubstitutor(H);
                    let s = predefined_replacements[H].args;
                    const args = predefined_replacements[H].args.split(',');
                    res = "("+ s + ")=>"+res(args);
                }
                else
                    throw "Block requires a block name";
            }
        // case 4.5: expression is the application of a block (x->y)
            else if (choice==4.5) {
                //const Arguments = encodeEach(Exp,vars);
                H = encode(Exp[0],vars); // block to encode
                // enforce(H, isString); // it's a function call - but not always a string, e.g. lambda! (!)
                // Arguments.shift(); // rest are arguments
                const Arguments = encode(Exp[1],vars);
                debugMsg("apply",H,"to",Arguments,isFunction(H));
                if (H.indexOf(")=>(")>-1) { //    H is a replacement (anon function)
                    res = "("+H+").apply(this,["+Arguments+"])";
                }
                else if ((H in predefined_functions) || tokens.contains(H))
                {
                    // NOT FINISHED if H is a token, we resolve it,
                    // but also we need to find and process the prerequisite functions
                    res = H+".apply(this,"+Arguments+")";
                }
                else if (H.indexOf("function")>-1) { //    H is a replacement (anon function)
                    res = "("+H+").apply(this,"+Arguments+")";
                }
                else {
                    throw "Apply requires a block";
                }
            }
        // case 5: predefined_replacements
            else if (choice==5) {
                let s = getSubstitutor(H);
                // should there be validation on number and type of arguments?
                let args = encodeEach(Exp,vars);
                res = s(args);
            }
        // case 6: expression is a function call
            else if (choice==6) {
                // getOperator returns the string defining the function
                let op = getOperator(H);
                // should there be validation on number and type of arguments?
                let args = encodeEach(Exp,vars);
                res = op(args); //H+"("+arguments.join(",")+")";
            } // case 6
        } // cases 3-6
    } // cases 2-6 (non-empty array)

    return res;
}

function caseOfHead(H) {
   if (H=="defun") return 3; //function definition
   if (H=="lambda") return 3.5; // lambda
   if (H=="assign") return 4; // variable
   if (H=="block") return 4.2; // function as data
   if (H=="apply") return 4.5; // call a function [ higher order type: (x -> y) -> z ]
   if (H in predefined_replacements) return 5; // JSON replacement
   if (H in predefined_functions) return 6; // JSON function
   return 2; // anything else - data array
}

function encodeEach(E,environment) {
    enforce(E, isArray);
    debugMsg("encoding each of",E, E.length);
    let Res = [];
    if (E.length>0) {
        debugMsg("encoding "+E[0]);
        let First = encode(E[0],environment);
        E.shift();
        Res = encodeEach(E,environment);
        if (First === null) {
            debugMsg("tokens - not added to exec");
        }
        else {
            Res.unshift(First);
        }
    }
   return Res;
}

// defun adds necessary code for the function definition and updates the list of functions available
// and the list of functions in use
// not correctly chunked - the work of defining the function,
// and its use, are tightly coupled here

// the syntax is javascript: foo = function (arguments) {return body;}
function defun(name,args,body) {
    // adds a function definition to the "predefined functions" JSON list
    debugMsg("defun",name,args,body);
    includedFunctions.add(name); // needed for recursive functions
    const fd = Object.create(FunData).init();
    fd.setName(name);
    fd.setLambda(args,body,this.environment);
    return fd.getFun();
}

<<<<<<< .mine
function lambda(args,body) {
    // adds a function definition to the "predefined functions" JSON list
    debugMsg("lambda",args,body);
    const fd = Object.create(FunData).init();
    fd.setLambda(args,body);
   debugMsg("lambda produces ",fd.js);
    return fd.getLambda();
}

=======
function lambda(args,body) {
    // adds a function definition to the "predefined functions" JSON list
    debugMsg("lambda",args,body);
    const fd = Object.create(FunData).init();
    fd.setLambda(args,body);
	debugMsg("lambda produces ",fd.js);
    return fd.getLambda();
}

>>>>>>> .theirs
const FunData = {

   init: function() {
      this.args = "";
      this.js = "null";
      this.name = null;
<<<<<<< .mine
      this.environment = Object.create(CodeString).init();
      return this;
=======
	   this.environment = Object.create(CodeString).init();
	   return this;
>>>>>>> .theirs
   },

   setName(name) {
      this.name = name;
      predefined_functions[name] = this;
      return this;
    },

   setLambda: function (args,body) {
      this.args = args.join(", ");
      tokens.stackAll(args); // tokens list is filled with the function arguments
      this.js = encode(body,this.environment);
      tokens.removeAll(args);
      return this;
   },

   getLambda: function () {
      const result = Object.create(CodeString).init();
      result.line("function ("+ this.args + ") {");
      result.insertCode(this.environment);
      result.line("return "+this.js+";");
      result.line("}");
      return result.text;
   },

   getFun: function() {
      return (this.name+" = "+this.getLambda());
   }
}

/*
TODO: Substitor object
===
+ready bool false // flag - true once preprocessing has been done
+definition JSON {args:"", js:""} // from JSON file
+argIndexes Array [] // of integers, the index of each argument to use
+resultParts Array [] // of strings, the code to use in between arguments
===
getSubstitutor
process
startswithwhich

const Substitutor = {

   init: function() {
      this.ready = false;
      this.definition = {};
      this.argIndexes = []; // of integers, the index of each argument to use
      this.resultParts = []; // of strings, the code to use in between arguments
      return this;
   },

    getSubstitutor: function(X) {
        let s;

        if (readyReplacements.contain(X)) {
            s = readyReplacements.get(X);
        }
        else {
            let rX = predefined_replacements[X];

            // parse rX.args and get strings to replace in the substitution
            let args = rX.args.split(',').map($.trim);

            // then parse rX.js - get the substrings that start with substitutions
            let reps = rX.js.split('@');

            // each string in reps (bar the first) starts with one of the strings in args
            // indexes is a list e.g. [0,1,2] of which argument, by number, must be inserted
            let indexes = [];
            // results_parts is a list of strings that need to be concatenated
            let result_parts = [reps[0]]; // ['','?',':',''] ;

            let i;
            for (i=1; i<reps.length; i++) {
                let ind = startsWithWhich(args, reps[i]); // find the index of the argument to use next
                indexes.push(ind); // add to indexes array
                let res_part = reps[i].slice(args[ind].length); // find the next substring
                result_parts.push(res_part);
            }

            // return a function that makes the subtitition
            // the function uses indexes and results_parts which are in its environment
            // (thank you closure!)
            s = function(bits) {
                    let res = '(';
                    for (let i=0; i<indexes.length; i++) {
                        res += result_parts[i]+bits[indexes[i]];
                    }
                    res += result_parts[i] + ')';
                    return res;
                };
            // add prerequisites to the code
            if (rX.requires) {
                let pre = rX.requires.map(getOperator);
                globalCode.line(pre.join(""));
            }

            readyReplacements.set(X,s);
        }

        return s;
    }

}

*/

function getSubstitutor(X) {
    let s;

    if (readyReplacements.contain(X)) {
        s = readyReplacements.get(X);
    }
    else {
        let rX = predefined_replacements[X];

        // parse rX.args and get strings to replace in the substitution
        let args = rX.args.split(',').map($.trim);

        // then parse rX.js - get the substrings that start with substitutions
        let reps = rX.js.split('@');

        // each string in reps (bar the first) starts with one of the strings in args
        // indexes is a list e.g. [0,1,2] of which argument, by number, must be inserted
        let indexes = [];
        // results_parts is a list of strings that need to be concatenated
        let result_parts = [reps[0]]; // ['','?',':',''] ;

        for (let i=1; i<reps.length; i++) {
            let ind = startsWithWhich(args, reps[i]); // find the index of the argument to use next
            indexes.push(ind); // add to indexes array
            let res_part = reps[i].slice(args[ind].length); // find the next substring
            result_parts.push(res_part);
        }

        // return a function that makes the subtitition
        // the function uses indexes and results_parts which are in its environment
        // (thank you closure!)
        s = function(bits) {
                let res = '(';
            let i;
                for (i=0; i<indexes.length; i++) {
                    res += result_parts[i]+bits[indexes[i]];
                }
                res += result_parts[i] + ')';
                return res;
            };
        // add prerequisites to the code
        if (rX.requires) {
            let pre = rX.requires.map(getOperator);
            globalCode.line(pre.join(""));
        }

        readyReplacements.set(X,s);
    }

    return s;
}

function getOperator(X) {

   if (includedFunctions.notContain(X)) {
      let fX = predefined_functions[X];
      includedFunctions.add(X);

      // concatenate function definition
      globalCode.line(
         "function "+ X + "(" + fX.args + ") {\n" +
         "   "+fX.body+"\n"+
         "}");

      // find pre-requisites
      if (fX.requires) {
         fX.requires.map(getOperator);
      }
   }

   return function (Args) {return X+"("+Args.join(",")+")";};
}

/* start with which takes a list of tokens and a string to check.
// It returns the index of the token with which the string starts
// if the string starts with none of them, it returns undefined. */
function startsWithWhich(toks, str) {
    for (let which=0; which<toks.length; which++) {
        if (str.indexOf(toks[which])==0) {
            return which;
        }
    }
    debugMsg('Not found any "'+toks+'" in "'+str+'"');
    return undefined;
}

/* collection classes
// bag = array of data (as in [a,b,c])
// with encapsulated functions for handling
*/
const Bag = {
   init: function() {
      this.list = [];
     return this;
   },

   clear: function() {
      this.list=[];
      return this;
   },

   empty: function() {
      return (this.size() == 0);
   },

   contains: function(e) {
      return this.list.indexOf(e)>=0;
   },

   queue: function (e) {
      this.list.push(e);
      return this;
   },

   queueAll: function (es) {
      debugMsg("queuing",es,"at the end of",this.list)
      es.forEach(e => this.queue(e));
      return this;
   },

   stack: function (e) {
      this.list.unshift(e);
      return this;
   },

   stackAll: function (es) {
      debugMsg("stacking ",es);
      const st = this.stack.bind(this);
      es.forEach(st);
      return this;
   },

   get: function(n) {
      return this.list[n];
   },

   remove: function (e) {
      if (this.contains(e)) {
         this.list.splice(this.list.indexOf(e),1)
         return this;
      } else {
         return false;
      }
   },

   removeAll: function (es) {
      const rm = this.remove.bind(this);
      return es.forEach(rm);
   },

   dequeue: function (n) {
      if (!n) n=1;
      do {this.list.shift();} while (n-->0);
      return this;
   },

   find: function(e) {
      return this.list.indexOf(e);
   },

   size: function() {
      return this.list.length;
   },

   map: function(f) {
      return this.list.map(f);
   }

};

const tokens = Object.create(Bag).init(); // was TokenCollection();

const TokenGenerator = {
      init: function(tok,index) {
      // tokenGenerator - makes strings token+number
      this.tokIndex = $.isNumeric(index)?parseInt(index):1;
      this.tokString = tok;
      return this;
   },
   next: function() {
      const res = this.tokString+this.tokIndex;
      this.tokIndex++;
      return res;
   },
   last: function() {
      return this.tokString+(this.tokIndex-1);
   },
   num: function() {
      return this.tokIndex;
   }
}

/* String extensions
   repeat, replaceAll, unescape */
String.prototype.repeat = String.prototype.repeat || function(n){
  n= n || 1;
  return Array(n+1).join(this);
}

String.prototype.replaceAll = String.prototype.replaceAll || function(search, replacement) {
    const target = this;
    return target.split(search).join(replacement);
};

String.prototype.unescape = function() {
    const target = this;
    return target //.replaceAll('\\n','\n').replaceAll('\\t','\t').replaceAll('\\\\','\\');
};

/* crude type checking
   there is a type checking library that would be more appropriate */
function enforce(X,check) {
    if (!check(X))
        throw JSON.stringify(X,null,3)+" fails the check "+check;
}

function isString(s) {
   return (typeof s === 'string' || s instanceof String);
}

function isArray(a) {
   return Object.prototype.toString.call(a) === '[object Array]';
   //return a.isArray(); // <-- should work
}

function isFunction(functionToCheck) {
   return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
}

function debugMsg() {
    if (debugMode) { // set debugMode to true to turn on debugging
        const m = [];
        const seen = [];
      let i;
        for (i in arguments) {
            const a = arguments[i];
            if (typeof a == "object" && a != null)
                m.push(JSON.stringify(a, function(key, val) {
                    if (typeof val == "object" && val != null) {
                       if (seen.indexOf(val) >= 0) {
                            return "_seen";
                       }
                       seen.push(val);
                    }
                    return val;
                } ) );
            else m.push(a);
        }
        console.log(m.join(" "));
    }
}

jsPlumb.ready(function() {
    // load js
    debugMsg("load js interpretation data");
    $.ajax({
        url: "js_blocks.json",
        beforeSend: function(xhr){
            if (xhr.overrideMimeType) {
                xhr.overrideMimeType("application/json");
            }
        },
        success: function(json) {
            debugMsg("found js data",json);
            predefined_functions = json.functions;
            predefined_replacements = json.replace;
        },
        error: function(_, status, err) {debugMsg(status+'\n'+err);}
    });
});

/* parameters of function
// source: https://www.geeksforgeeks.org/how-to-get-the-javascript-function-parameter-names-values-dynamically

// lookup regexp to find how to reomove from pattern (=>) to end of a string
*/
function getParams(func) {

    // String representaation of the function code
    const str = func.toString()
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments of the form /* ... */
            .replace(/\/\/(.)*/g, '') // Removing comments of the form //
            .replace(/{[\s\S]*}/, '') // Remove body of the function { ... }
            .replace(/=>*/g, ''); // removing '=>' if func is arrow function

    // Start parameter names after first '('
    const start = str.indexOf("(") + 1;

    // End parameter names is just before first ')'
    const end = str.indexOf(")");

    const result = str.substring(start, end).split(",");

    let params = [];

    result.forEach(element => {

        // Removing any default value
        element = element.replace(/=[\s\S]*/g, '').trim();

        if(element.length > 0)
            params.push(element);
    });

    return params;
}

/*

// Nov 2019: 2760 LOC (includes config data)

// encapsulation in ES5
const Animal = {
  init: function(name,species) {
    this.name = name;
    this.species = species;
   return this;
  },
  move: function() {
    console.log('move');
  }
}

const Cat = {
  __proto__: Animal,
  init: function(name) {
    this.__proto__.init('Cat');
   return this;
  }
}

fluffy = Object.create(Cat).init('fluffy');
fluffy.move()


(plus 2 3) in JSON = ["plus", 2, 3]

(1 2 3) in JSON = [1, 2, 3]

Examples of expression that ought to be interpretable:

[
  ["defun", "square", ["x"], ["times", "x", "x"]],
  ["square", 2]
]

result:
   function square(x) { return x*x; }
   square(2);

=============

[
  ["defun", "fac", ["n"], ["if", ["lt", "n", 2], 1, ["times", "n", ["fac", ["minus", "n", 1]] ]]],
  ["fac", 10]
]

result:
   function fac(n) {return lt(n,2)?1:times(n,fac(n-1));}
   fac(10);

====== map defined from "apply" ====

["apply", "plus", [1, 2]]

result:
   plus(1,2);
   function plus(a,b) {return a+b;}

===

(defun
    map
    (f arr)
    (if (empty arr)
        ()
        (concat
            (apply
                f
                ((first arr))
            )
            (map f (rest arr))
        )
    )
)

===

definition of map - result

function map(f,arr) {
   return (empty(arr))?[]:concat(f(first(arr)),map(f,rest(arr)));
}

================ example of map =============

[
  ["defun", "map",
            ["f", "arr"],
            ["if", ["isEmpty", "arr"],
                   [],
                   ["cons",
                         ["apply", "f", [["first", "arr"]] ],
                         ["map", "f", ["rest", "arr"] ]
                   ]
            ]
  ],
  ["map", "\\isNumber", [1,2,3,"a","b","c"] ]
]

// works in js (June 2017)
// result:

// Automatically generated code

function isEmpty(a) {return $.isArray(a) && a.length==0;}

function cons(elt,list) {list.unshift(elt);return list;}

function map(f, arr) {
   return isEmpty(arr)?[]:cons(f.apply(this,[arr[0]]),map(f,arr.slice(1)));
}

function isNumber(n) {return $.isNumeric(n);}

function main() { return map(isNumber,[1,2,3,"a","b","c"]); }

====================== minimal example of lambda / apply =============

[  "apply",
   [  "lambda",
      [  "n" ],
      [  "plus", "n", 1  ]
   ],
   [ 3 ]
]

// result: November 2019

// Automatically generated code

function pipe() {
   return (function (n) {
      return (n+1);
   }).apply(this,[3]);
}

============================ example of compose ======================

[ "defun",
  "compose",
  [ "f", "g" ],
  [ "lambda",
    [ "x" ],
    [ "apply",
      "f",
      [ "cons", [ "apply", "g", [ "x" ] ], [] ]
    ]
  ],
  [ "apply",
    [ "compose", [ "block", "sin" ], [ "block", "sqrt" ] ],
    3
  ]
]

// works in js (Nov 2019)
// result:
// Automatically generated code

function cons(elt,list) {
   list.unshift(elt);return list;
}

compose = function (f, g) {
   return function (x) {
      return f.apply(this,cons(g.apply(this,[x]),[]));
   };
}

function pipe() {
   return (compose((a)=>(Math.sin(a)),(a)=>(Math.sqrt(a)))).apply(this,[3]);
}

========================================================

[  "defun",
   "distance",
   [  "a",  "b"  ],
   [  "defun",
      "square",
      [  "x"  ],
      [  "times",  "x",   "x"  ],
      [  "sqrt",
         [  "plus",
            [  "square",  "a"  ],
            [  "square",  "b"  ]
         ]
      ]
   ],
   [  "distance", 3, 4  ]
]

// works in js (Nov 2019)
// result:

square = function (x) {
   return (x*x);
}

distance = function (a, b) {
   return (Math.sqrt((square(a)+square(b))));
}

function pipe() { return distance(3,4); }

*/

