/*

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

[
  ["defun", "fac", ["n"], ["if", ["lt", "n", 2], 1, ["times", "n", ["fac", ["minus", "n", 1]] ]]],
  ["fac", 10]
]

result:
   function fac(n) {return lt(n,2)?1:times(n,fac(n-1));}
   fac(10);

*/

/*
Set of predefined functions
predefined functions both define the gui blocks
and this compilation, so the functions are loaded in the editor

as well as functions, some substititions are allowed
this is still in progress.
a call is either substitution or function;
substitutions may have prerequisite functions; but not prerequisite substitutions (?)
substitutions could uncoupling language specific structures
and replace special cases of the compiler engine
like conditionals and possibly function definition

A stack of defined vars (setq) is also maintained
*/

// String with the resulting code
// plus simple encapsulatedd functions
var code = {
    text: "",
    clear: function() { code.text = ""; },
    line: function(lin) { code.text += lin + "\n\n"; }
};

// list of functions in use (to not repeat them)
var includedFunctions = {
    list: [],
    clear: function() { 
        includedFunctions.list=[];
        return includedFunctions;
    },
    notContain: function(F) {
        return includedFunctions.list.indexOf(F) === -1;
    },
    add: function (F) {
        includedFunctions.list.push(F);
        return includedFunctions;
    }
}

// list of substitutions already parsed
var readyReplacements = {
    list: [],
    clear: function() { 
        readyReplacements.list=[];
        return readyReplacements;
    },
    contain: function(X) {
        return readyReplacements[X] === null;
    },
    set: function (X,R) {
        readyReplacements.list[X] = R;
        return readyReplacements;
    },
    get: function (X) {
        if (readyReplacements.contain(X))
            return readyReplacements[X]
        else
            return false;        
    }
}


// list of tokens (variables) in use, to parse them
// with encapsulated functions for handling the list
var tokens = {
    list: [],
    clear: function() { tokens.list=[]; },
    contain: function(tok) {
        return tokens.list.indexOf(tok)>-1;
    },
    add: function (tok) {
        tokens.list.unshift(tok);
        return tokens;
    },
    addAll: function (toks) {
        debugMsg(toks); 
        toks.map(tokens.add)
    },
    remove: function (tok) {
        if (tokens.contain(tok)) {
            return false;
        } else {
            tokens.list.splice(list.indexOf(tok),1)
            return tokens;
        }
    },
    removeAll: function (toks) {
        toks.map(tokens.remove);
    },
    shift: function (n) {
        if (!n) n=1;
        do {tokens.list.shift();} while (n-->0);
        return tokens;
    }
};

function compile(Exp) {
   code.clear();
   code.line("// Automatically generated code");
   includedFunctions.clear();
   tokens.clear();
   readyReplacements.clear();
   var call = encode(Exp);
   code.line("process("+call+");");
   return code.text;
}

function encode(Exp) {
    var res = "";
    
    if (Exp instanceof Array) {
        debugMsg(Exp+" is an Array");
    // case 1: expression is an empty array
        if (Exp.length==0) res = [];
        else { // non-empty array
            var H = Exp[0];
            
    // case 2: expression is a function definition
            if (H == "defun") {
                defun(Exp);
            }
            
    // case 2a: expression is a variable setting
            else if (H == "setq") {
                var tok = Exp[1];
                tokens.add(tok);
                code.line("var "+tok+" = "+encode(Exp[2])+";");
            }
    
    // case 3 predefined_replacements
            else if (H in predefined_replacements) {
                var s = getSubstitutor(H);
                Exp.shift();
                // should there be validation on number and type of arguments?
                Arguments = encodeEach(Exp);
                res = s(Arguments);
            }
            else if (H in predefined_functions) {
    // case 4: expression is a function call
                // getOperator returns the string defining the function
                var op = getOperator(H);
                Exp.shift();
                // should there be validation on number and type of arguments?
                Arguments = encodeEach(Exp);
                res = op(Arguments); //H+"("+Arguments.join(",")+")";
            } else
    // case 5: expression is any other array - treated like a data array
                res = "["+encodeEach(Exp)+"]";
        }
    }
    else if (isString(Exp)) {
    // case 6: expression is a known variable
        if (tokens.contain(Exp)) res = Exp
    // case 7: expression is a string
        else res = '"'+Exp+'"';
    }
    // case 8: expression is anything else - left unprocessed - works for number, boolean, null
    else res = Exp;
    
    // done
    return res;
}

function encodeEach(E) {
    debugMsg("encoding each of "+E);
    if (E instanceof Array) {
        var Res = [];
        if (E.length>0) {
            debugMsg("encoding "+E[0]);
            var First = encode(E[0]);
            E.shift();
            var Res = encodeEach(E);
            if (First != "") {Res.unshift(First);}
        }
       return Res;
    }
    else throw "Should get an array, received "+JSON.stringify(E);
}

// defun adds necessary code for the function definition and updates the list of functions available
// and the list of functions in use
// the syntax is javascript: funtion foo(arguments) {return body;}
function defun(Exp) {
    // adds a function definition to the "predefined functions" JSON list
    var name = Exp[1];
    var args = Exp[2];
    var f = {};
    f["args"] = args.join(", ");
    predefined_functions[name] = f;
    includedFunctions.add(name);
    tokens.addAll(args); // tokens list is filled with the function arguments
    debugMsg(tokens);
    var body = "return "+encode(Exp[3])+";";
    f["body"] = body;
    tokens.removeAll(args);
    code.line("var "+ name + " = function (" + f["args"] + ") {" + body +"}");
}

function getSubstitutor(X) {
    var s;
    
    if (readyReplacements.contain(X)) {
        s = readyReplacements.get(X);
    }
    else {
        rX = predefined_replacements[X];
        
        // parse rX.args and get strings to replace in the substitution
        args = rX.args.split(',').map(String.trim);
        
        // then parse rX.js - get the substrings that start with substitutions
        reps = rX.js.split('@');
        
        // each string in reps (bar the first) starts with one of the strings in args
        // indexes is a list e.g. [0,1,2] of which argument, by number, must be inserted
        var indexes = [];
        // results_parts is a list of strings that need to be concatenated
        var result_parts = [reps[0]]; // ['','?',':',''] ;

        for (var i=1; i<reps.length; i++) {
            ind = startsWithWhich(args, reps[i]); // find the index of the argument to use next
            indexes.push(ind); // add to indexes array
            res_part = reps[i].slice(args[ind].length); // find the next substring
            result_parts.push(res_part);
        }

        // return a function that makes the subtitition
        // the function uses indexes and results_parts which are in its environment
        // (thank you closure!)
        s = function(bits) {
                res = '';
                for (var i=0; i<indexes.length; i++) {                
                    res += result_parts[i]+bits[indexes[i]];
                }
                res += result_parts[i];
                return res;
            };
        // add prerequisites to the code
        if (rX.requires) {
            var pre = rX.requires.map(getOperator);
            code.line(pre.join(""));
        }

        readyReplacements.set(X,s);
    }

    return s;
}

function getOperator(X) {
    
    if (includedFunctions.notContain(X)) {
        fX = predefined_functions[X];
        includedFunctions.add(X);

        // concatenate function definition
        code.line("function "+ X + "(" + fX.args + ") {" + fX.body +"}");

        // find pre-requisites
        if (fX.requires) {
            fX.requires.map(getOperator);
            // code.line(pre.join(""));
        }
    }
    
    return function (Args) {return X+"("+Args.join(",")+")";};
}

function process(Exp) {
   // calls the compiled instructions, respecting the structure, and returns a string to display.
   
    var res;

    if (Exp instanceof Array) {
        res = Exp.map(process);
    }
    else {
        res = eval(Exp);
        if (typeof(res == "undefined")) res = Exp;
    }
    // done
    return res;

}

// start with which takes a list of tokens and a string to check.
// It returns the index of the token with which the string starts
// if the string starts with none of them, it returns undefined.
function startsWithWhich(toks, str) {
    for (var which=0; which<toks.length; which++) {
        if (str.indexOf(toks[which])==0) {
            return which;
        }
    }
    debugMsg('Not found any "'+toks+'" in "'+str+'"');
    return undefined;
}

function isString(s) {
   return (typeof s === 'string' || s instanceof String)
}

function debugMsg() {
    var debug = true; // set to true to turn on debugging
    if (debug) {
        var m = '';
        for (i in arguments) {
            m += JSON.stringify(arguments[i]);
        }
        console.log(m);
    } 
}
