
/* Set of predefined functions
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

// should use collection classes!
let predefined_functions = {}
    predefined_replacements = {};

// flag to process strings as potential variables
// used when interpreting lambda expressions
// it shouldn't be a global variable - but - in progress
let lambdaFlag = false;

// String with the resulting code
// plus simple support for layout
const CodeString = {
   nl: "\n",
   tabbing: 3,

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
      const addition = this.lineHead + lin + this.nl
      this.text += addition
      debugMsg("added",addition)
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
        this.list = [];
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

/* The "process" needs improvemet
Need a wrapper object to
- limit the scope of needed functions
- secure the execution
- provide support e.g. display, timing, execution journal
*/

function compile(Exp) {
   includedFunctions.clear();
   tokens.clear();
   readyReplacements.clear();
   globalCode.clear();
   globalCode.line("// Automatically generated code");
   globalCode.skip();
   const call = encode(Exp,globalCode);
   globalCode.line("async function pipe() {");
   globalCode.nest();
   globalCode.line("return "+call+";");
   globalCode.denest();
   globalCode.line("}");
   debugMsg("Compilation done",globalCode.text)
   return globalCode.text;
}

function encode(Exp,vars) {

   // cases 1 to 7 - Exp is an array
   if (isArray(Exp)) {
      return encodeArray(Exp,vars);
   }

   if (isString(Exp)) {

      // expression is of the form `x` - could be a symbol
      if (Exp.substring(0,1)=="`" && Exp.substring(Exp.length-1)=="`") {

         const H = Exp.substring(1,Exp.length-1)

         debugMsg("Maybe ",Exp,"is a reference to existing variable or function");

         if ( tokens.contains(H)) { // si H est une variable, la garder
             return H;
         }

         if ((H in predefined_functions)) { // si H est une fonction
             getOperator(H); // ajouter H aux fonctions en usage
             return H;       // et garder
         }

         if (H in predefined_replacements) { // si x est un remplacement
             // ajouter x = (arg1, ...) => (...) -- exemple plus = (a,b) => (a+b);
             debugMsg(H,"is predefined, ");
             const sub = getSubstitutor(H);
             let s = predefined_replacements[H].args;
             return "("+ s + ")=>"+sub(s.split(','));
         }

      }
      // expression is a data string
      return '"'+escape_quotes(Exp)+'"';
   }

   // expression is an object {key: ...}
   if (typeof Exp === 'object') {
      let result = "{"
      let cont = false
      for (const entry in Exp) {
         if (cont) result+=","        
         result +=  entry + ":" + encode(Exp[entry],vars);
         cont = true
      }
      return result+"}"
   }

   // expression is anything else - left unprocessed
   return Exp;
 
   // escape quotes: sanitise strings
   function escape_quotes(S) {
      S = S.replaceAll('"','\\"').replaceAll("'","\\'").replaceAll("`","\\`");
      return S
   }

}

function encodeArray(Exp, vars) {
   let res = null;
   // Case 1: expression is an empty array
   if (Exp.length==0) return '[]';

   // Cases 2- : non-empty array
   let H = Exp[0]; // take the head and tail
   let choice = caseOfHead(H);
   debugMsg("case of",H,"is",choice)

   //  Case 2: Exp is a data array
   if (choice==2) return '['+encodeEach(Exp,vars)+']';

   // case 3.5: expression is a lambda-expression
   if (choice==3.5) {
       return encodeLambda(Exp[1],Exp[2],globalCode);
   }

   // case 4.5: expression is an application
   if (choice==4.5) {
      let [_, Block, ...Arguments] = Exp
      debugMsg("Apply, block is ",Block,"Arguments",Arguments)
      let blockCode

      if (isArray(Block)) {
         // Exp could be [app , Block, ...args]
         // where Block produces a function
         const fnCode = encodeArray(Block); // block to encode
         blockCode = (args) => (`(${fnCode})(${args.join(",")})`)
      } else {
         enforce(Block, isString) // Exp = [app, fn_name, ...args]
         let backTicks = false

         if (Block.substring(0,1)=="`" && Block.substring(Block.length-1)=="`") {
            Block = Block.substring(1,Block.length-1)
            backTicks = true
            debugMsg("backticks, stripped block name",Block)
         } else {
            debugMsg("no backticks, block name",Block)              
         }

         if (Block in predefined_replacements) {
            debugMsg(Block,"is a replacement")
            blockCode = getSubstitutor(Block);
            // should there be validation on number and type of arguments?
         } else if (Block in predefined_functions) {
            debugMsg(Block,"is a function")
            // getOperator returns the string defining the function
            blockCode = getOperator(Block);
            // should there be validation on number and type of arguments?
         } else if (tokens.contains(Block)) {
            debugMsg(Block,"is a symbol")
            // the blockname is a symbol reference (blocks are "first class")
            blockCode = (args) => (`${Block}(${args.join(",")})`)
         } else {
            throw(`${Block} should be a function name or a variable`);
         }
      }

      const args = encodeEach(Arguments,vars);
      debugMsg("Function arguments are",args)
      return blockCode(args);
 
   }

   // case 7: expression is an environment
   if (choice==7) {
      const dict = Exp[1] // Dictionary of name:value pairs

      for (const tok in dict) {
         const SubExp = dict[tok]
         debugMsg("Is", SubExp,"lambda or var")
         if (isArray(SubExp) && SubExp[0] == "`lambda`") {
             debugMsg("lambda", tok)
             globalCode.line(defun(tok,SubExp[1],SubExp[2]))
             globalCode.skip();
         } else {
             debugMsg("var")
             tokens.stack(tok);
             vars.line("let "+tok+" = "+encode(dict[tok],vars)+";");
         }
      }

      return encode(Exp[2],vars); // Exp[1] is the thing to return

   }

}

function caseOfHead(H) {
   debugMsg("Checking case of",H)
   if (isString(H)) {
        if (H=="`lambda`") return 3.5; // lambda
        if (H=="`app`") return 4.5; // call a function
        if (H=="`let`") return 7; // JSON function
   }
   return 2; // anything else - data array
}

function encodeEach(E,environment) {
   enforce(E, isArray);
   debugMsg("encoding each of",E, E.length);
   let Res = [];
   if (E.length>0) {
      let First = null
      debugMsg("encoding ",E[0]);
      if (E[0] === null) {
          debugMsg("Nothing to encode")
      } else {
         First = encode(E[0],environment);
      }
      E.shift();
      Res = encodeEach(E,environment);
      if (First === null) {
         debugMsg("tokens or null - not added to exec");
      }
      else {
         Res.unshift(First);
      }
   }
   return Res;
}


// defun adds necessary code for the function definition
// also updates the lists of functions available and functions in use
// not correctly chunked - the work of defining the function,
// and its use, are tightly coupled here

// the syntax is javascript: foo = function (arguments) {return body;}
function defun(name,args,body) {
    // adds a function definition to the "predefined functions" JSON list
    debugMsg("function",name,args,body);
    includedFunctions.add(name); // needed for recursive functions
    const fd = Object.create(FunData).init();
    fd.setName(name);
    fd.setLambda(args,body);
    return fd.getFun();
}

/* Lambda, needs TLC
Especially
 - resolution of tokens
 - risks of injection
*/

function encodeLambda(argsExp,bodyExp,context) {
   debugMsg("lambda",argsExp,bodyExp);
   const fd = Object.create(FunData).init();
   // fd.setInterpretLambda(argsExp,bodyExp,context); // complicated
   fd.setLambda(argsExp,bodyExp,context);
   // fd.setInterpretLambda
      // encode the argument expression; leads to executable expression 
      // which when executed (at run time) yields the list of arguments
   // fd.getInterpretLambda // complicated 
   return fd.getLambda();
}

function expCheck(v) {
   if (typeof v == "object" && v != null)
       return JSON.stringify(v);
   return v.toString();
}

const FunData = {

   init: function() {
      this.args = "";
      this.js = "null";
      this.name = null;
      this.environment = Object.create(CodeString).init();
      return this;
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

   /* setInterpretLambda: function (args,body,context) {
      const LArgs = encode(args,context);
      lambdaFlag = true;
      let LBody = encode(body,this.environment);
      lambdaFlag = false;
      LBody = (this.environment.text + "return "+LBody+';').replaceAll('\n',' ');
      this.js = "eval(make_lambda("+LArgs+", '"+LBody+"'))";
      return this;
   },

   getInterpretLambda: function () {
      return this.js;
   }, */

   getFun: function() {
      return (this.name+" = "+this.getLambda());
   }
}

/* TODO: Substitutor object
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

   // if it's been done before: early exit
   if (readyReplacements.contain(X)) return readyReplacements.get(X);

   let s;
   debugMsg("substituting",X,"replacement is",predefined_replacements[X]);

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

   // return a function that makes the substitution
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

   return s;
}

function getOperator(X) {
   debugMsg("looking for",X)
   if (includedFunctions.notContain(X)) {
      debugMsg("Not there yet. Adding")
      let fX = predefined_functions[X];
      includedFunctions.add(X);

      // concatenate function definition
      globalCode.line("function "+ X + "(" + fX.args + ") {")
                .nest().line(fX.body).denest()
                .line("}");

      // find pre-requisites
      if (fX.requires) {
         fX.requires.map(getOperator);
      }
   }

   return function (Args) {return X+"("+Args.join(",")+")";};
}

/* start with which takes a list of tokens and a string to check.
   // It returns the index of the token with which the string starts
   // if the string starts with none of them, it returns undefined.
*/
function startsWithWhich(toks, str) {
    for (let which=0; which<toks.length; which++) {
        if (str.indexOf(toks[which])==0) {
            return which;
        }
    }
    debugMsg('Not found any "'+toks+'" in "'+str+'"');
    return undefined;
}

// collection classes

/* Bag = array of data (as in [a,b,c])
   with encapsulated functions for handling
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

   insert: function (e) {
      const pos = this.sortedIndex(e);
      this.list.splice(pos, 0, e);
      return this;
   },

   sortedIndex: function(value) {
      var lo = 0,
          hi = this.list.length;

      while (lo < hi) {
         var mid = (lo + hi) >>> 1;
         if (this.list[mid] < value) lo = mid + 1;
         else hi = mid;
      }
      return lo;
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

   set: function(n,val) {
      if (n<0 || n>=this.size()) return false;
      if (!val) return false;
      this.list[n]=val;
      return this;
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
   },
   
   forEach(f) {
      this.list.forEach(f);
   }

};


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
         return undefined;
      this.list[lbl] = e;
      return this;
   },

   copy: function (oldLbl,newLbl) {
      let result = this.get(oldLbl);
      if (typeof result !== 'undefined') {
         result = this.add(newLbl,result);
      }
      return this;
   },

   rename: function (oldLbl,newLbl) {
      let result = this.copy(oldLbl,newLbl).get(newLbl);
      if (typeof result !== 'undefined') {
         this.remove(oldLbl);
      }
      return this;
   },

   set: function (lbl,e) {
      this.list[lbl] = e;
      return this;
   },

   setAll: function (data) {
      data.map((lbl)=>this.add(lbl,data[lbl]));
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
   },

   forEach: function(f) {
      for (key in this.list) {
         f(this.list[key]); // 'this' context is messy
      }
   }

}

const tokens = Object.create(Bag).init(); // was TokenCollection();

const TokenGenerator = {
   init: function(tok,index) {
      // tokenGenerator - makes strings token+number
      this.tokIndex = $.isNumeric(index)?parseInt(index):1;
      this.tokString = tok;
      return this;
   },
   next: function() { // next token, then increment index
      const res = this.tokString+this.tokIndex;
      this.tokIndex++;
      return res;
   },
   back: function() { // next token, then increment index
      this.tokIndex--;
      return this;
   },
   last: function() { // last index (index of the *last* token)
      return this.tokString+(this.tokIndex-1);
   },
   num: function() { // current index (index of the *next* token
      return this.tokIndex;
   }
}

const queryString = {
   init: function() {
      this.values = {};
      const s = window.location.href.split("?");
      if (s.length != 2) return this;
      this.parse(s[1]);
      return this;
   },

   parse: function(str) {
      const pairs = str.split("&");
      pairs.forEach( (pair) => {
         let p = pair.split("=");
         this.values[p[0]]=p[1];
      } )
      debugMsg("Query string: ",this.values);
   },

   get: function(feat){
      return this.values[feat];
   }

}

/* String extensions repeat, replaceAll, unescape */
String.prototype.repeat = String.prototype.repeat || function(n=1){
  return Array(n+1).join(this);
}

String.prototype.replaceAll = String.prototype.replaceAll || function(search, replacement) {
    const target = this;
    return target.split(search).join(replacement);
};

String.prototype.unescape = function() {
    const target = this;
    return target //.replaceAll('\\n','\n').replaceAll('\\t','\t')..replaceAll('\\`','`').replaceAll('\\\\','\\');
};

/* crude type checking */
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
            let a = arguments[i];
            if (typeof a == "object" && a != null)
               a = JSON.stringify(a, function(key, val) {
                  if (typeof val == "object" && val != null) {
                     if (seen.indexOf(val) >= 0) {
                        return "_seen";
                     }
                     seen.push(val);
                  }
                  return val;
               } );

            m.push(a);
        }
        console.log(m.join(" "));
    }
}

function messagerise(f,text) {
   return function() {
      const r = f.apply(this,arguments)
      debugMsg(text,r)
      return r
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
            const p = json.functions;
            for (let i of Object.keys(p)) {
               predefined_functions[ i ] = p[ i ];
            }
            const q = json.replace;
            for (let i of Object.keys(q)) {
               predefined_replacements[ i ] = q[ i ];
            }
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

// Nov 2019: 2760 LOC (includes config data)

/* encapsulation in ES5
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
*/
