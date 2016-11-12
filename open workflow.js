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

// var code; // code of functions to include in result
var counted; // list of functions in use (to not repeat them)
var ready_replacements; // list of substitutions already parsed

// list of variables in use (to parse them)
// with encapsulated functions for handling the list
var code = {
    text: "",
    clear: function() { code.text = ""; },
    line: function(lin) { code.text += lin + "\n\n"; }
};

function compile(Exp) {
   code.clear();
   code.line("// Automatically generated code");
   counted = [];
   tokens.clear();
   ready_replacements = [];
   var call = encode(Exp);
   code.line("process("+call+");");
   return code.text;
}

function encode(Exp) {
    var res = "";
    
    if (Exp instanceof Array) {
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
                tokens.add(tok)
                code.line("var "+tok+" = "+encode(Exp[2])+";");
            }
    
    // case 3 predefined_replacements
            else if (H in predefined_replacements) {
                var s = getSubstitutor(H);
                Exp.shift();
                // should there be validation on number and type of arguments?
                Arguments = Exp.map(encode);
                res = s(Arguments);
            }
            else if (H in predefined_functions) {
    // case 4: expression is a function call
                // getOperator returns the string defining the function
                var op = getOperator(H);
                Exp.shift();
                // should there be validation on number and type of arguments?
                Arguments = Exp.map(encode);
                res = op(Arguments); //H+"("+Arguments.join(",")+")";
            } else
    // case 5: expression is any other array - treated like a data array
                res = "["+Exp.map(encode)+"]";
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
    counted.push(name);
   
    tokens.addAll(args); // for (var i=args.length; i>0; i--) {toks.add(args[i-1]);} // tokens list is filled with the function arguments
    debugMsg(tokens);
    var body = "return "+encode(Exp[3])+";";
    f["body"] = body;
    tokens.removeAll(args);
    code.line("var "+ name + " = function (" + f["args"] + ") {" + body +"}");
}

function getSubstitutor(X) {
    var s;
    
    if (ready_replacements[X]) {
        s = ready_replacements[X];
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

        ready_replacements[X] = s;
    }

    return s;
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
    console.log('Not found any "'+toks+'" in "'+str+'"');
    return undefined;
}

function getOperator(X) {
    
    if (counted.indexOf(X) === -1) {
        fX = predefined_functions[X];
        counted.push(X);

        // concatenate function definition
        code.line("function "+ X + "(" + fX.args + ") {" + fX.body +"}");

        // find pre-requisites
        if (fX.requires) {
            var pre = fX.requires.map(getOperator);
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

function isString(s) {
   return (typeof s === 'string' || s instanceof String)
}

// list of variables in use (to parse them)
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

function debugMsg(m) {
    // uncomment this line to display debug data
    // console.log(JSON.stringify(m)+'\n');
}
