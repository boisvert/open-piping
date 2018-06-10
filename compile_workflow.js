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

A stack of defined vars (setq) is also maintained
*/

// String with the resulting code
// plus simple encapsulated functions
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

// list of tokens (variables) in use, to parse them
// with encapsulated functions for handling the list
var tokens = {
    list: [],

    clear: function() {
        tokens.list=[];
        return tokens;
    },

    contain: function(tok) {
        return tokens.list.indexOf(tok)>=0;
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

// list of substitutions already parsed
var readyReplacements = {
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
    var res;
    
    if (isArray(Exp)) {
    // cases 1 to 6 - Exp is an array
        res = encodeArray(Exp);
    }
    else if (isString(Exp)) {
    // case 7: expression is a known variable
        if (tokens.contain(Exp)) res = Exp;
    // case 7.5 (ahem...) - expression is a function being given as parameter
	    else if(Exp.indexOf('\\') == 0) {
			res = Exp.substring(1);
			getOperator(res); 
		}
    // case 8: expression is a string
        else res = '"'+Exp+'"';
    }
    // case 9: expression is anything else - left unprocessed - works for number, boolean, null
    else res = Exp;

    // done
    return res;
}

// "call_fn": {"args": "f, arr", "body":"var fn=window[f]; return fn.apply(this,arr);"},

function encodeArray(Exp) {
    
    var res;
    // case 1: expression is an empty array
    if (Exp.length==0)
        res = '[]';
    else
    // Cases 2-6: non-empty array 
    {
        var H = Exp[0]; // take the head
        var choice = caseOfHead(H);
    
        if (choice==2)
        //  case 2: Exp is a data array
            res = '['+encodeEach(Exp)+']';
        else
        {
            Exp.shift(); // keep all but the head

        // case 3: expression is a function definition
            if (choice==3) {
                defun(Exp);
            }
        // case 4: expression is a variable setting
            else if (choice==4) {
                var tok = Exp[0];
                tokens.add(tok);
                code.line("var "+tok+" = "+encode(Exp[1])+";");
            }
        // case 4.5: (yeah, well...) expression is a higher order function (x->y)->z
            else if (choice==4.5) {
				Arguments = encodeEach(Exp);
				H = Arguments[0]; // new head
				enforce(H, isString); // must be a string: it's a function call (!)
 				Arguments.shift(); // rest are arguments
				if ((H in predefined_functions) || tokens.contain(H)) {
					// if H is a token - when token resolved, we need to find and process the prerequisite functions
					res = H+".apply(this,"+Arguments+")";
				}
				//	H is a replacement... TBC
				else if (H in predefined_replacements) {
					res = "work in progress";
				}
				else
				    throw "Apply requires a predefined function";	
			}
        // case 5: predefined_replacements
            else if (choice==5) {
                var s = getSubstitutor(H);
                // should there be validation on number and type of arguments?
                Arguments = encodeEach(Exp);
                res = s(Arguments);
            }
        // case 6: expression is a function call
            else if (choice==6) {
                // getOperator returns the string defining the function
                var op = getOperator(H);
                // should there be validation on number and type of arguments?
                Arguments = encodeEach(Exp);
                res = op(Arguments); //H+"("+Arguments.join(",")+")";
            } // case 6
        } // cases 3-6
    } // cases 2-6 (non-empty array)

    return res;
}

function caseOfHead(H) {
   if (H=="defun") return 3; //function definition
   if (H=="setq") return 4; // variable
   if (H=="apply") return 4.5; // call a function [ higher order type: (x -> y) -> z ]
   if (H in predefined_replacements) return 5; // JSON replacement
   if (H in predefined_functions) return 6; // JSON function
   return 2; // anything else - data array
}

function encodeEach(E) {
    debugMsg("encoding each of "+E);
    enforce(E, isArray);
    var Res = [];
    if (E.length>0) {
        debugMsg("encoding "+E[0]);
        var First = encode(E[0]);
        E.shift();
        var Res = encodeEach(E);
        //if (First != "") {
			Res.unshift(First);
		/*}*/
    }
   return Res;
}

// defun adds necessary code for the function definition and updates the list of functions available
// and the list of functions in use
// the syntax is javascript: funtion foo(arguments) {return body;}
function defun(Exp) {
    // adds a function definition to the "predefined functions" JSON list
    var name = Exp[0];
    var args = Exp[1];
    var f = {};
    f["args"] = args.join(", ");
    predefined_functions[name] = f;
    includedFunctions.add(name);
    tokens.addAll(args); // tokens list is filled with the function arguments
    debugMsg(tokens);
    var body = "return "+encode(Exp[2])+";";
    f["body"] = body;
    tokens.removeAll(args);
    code.line("var "+ name + " = function (" + f["args"] + ") {" + body +"}");
}

/*
TODO: replacement object
===
+ready bool false // flag - true once preprocessing has been done
+definition JSON {args:"", js:""} // from JSON file
+argIndexes Array [] // of integers, the index of each argument to use
+resultParts Array [] // of strings, the code to use in between arguments
===
getSubstitutor
process
startswithwhich

*/

function getSubstitutor(X) {
    var s;
    
    if (readyReplacements.contain(X)) {
        s = readyReplacements.get(X);
    }
    else {
        rX = predefined_replacements[X];
        
        // parse rX.args and get strings to replace in the substitution
        args = rX.args.split(',').map($.trim);
        
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
   
    debugMsg('processing ', Exp);
    var res;

    if (isArray(Exp)) {
        res = Exp.map(process);
    }
    else if(isString(Exp)) {
        debugMsg('processing a string ',Exp)
        res = Exp;
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

// crude type checking
// there is a type checking library that would be more appropriate
function enforce(X,check) {
    if (!check(X))
        throw JSON.stringify(X)+" fails the check "+check;
}

function isString(s) {
   return (typeof s === 'string' || s instanceof String);
}

function isArray(a) {
   return (typeof a === 'array' || a instanceof Array);
}

function debugMsg() {
    var debug = true; // set to true to turn on debugging
    if (debug) {
        var m = [];
		var seen = [];
        for (i in arguments) {
            m.push(JSON.stringify(arguments[i], function(key, val) {
				if (val != null && typeof val == "object") {
					if (seen.indexOf(val) >= 0) {
						return "_seen";
					}
					seen.push(val);
				}
				return val;
			}
			));
        }
        console.log(m.join(" "));
    }
}

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

// almost works in js (12 April 2017)
// result:
// Automatically generated code

var map = function (f, arr) {return (arr.length==0)?map(f,arr.slice(1)).unshift(f.apply(this,arr[0])):undefined;}

process([,map("isNumber",[1,2,3,"a","b","c"])]);

==================

an alternative notation?

]}

*/

