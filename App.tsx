import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Parser, ParserException } from './utils/parser';
import { AppTheme } from './utils/theme';
import { JigglyButton } from './components/JigglyButton';

// --- Regression Testing Suite ---
const runStrictTests = () => {
  console.log('--- Running Deep Regression Suite ---');
  
  const check = (expr: string, expected: any) => {
    try {
      const clean = expr.replace(/x/g, '*').replace(/÷/g, '/');
      const parser = new Parser(clean);
      const result = parser.parse();

      if (typeof expected === 'string') {
        throw new Error(`FAILED: "${expr}" -> Expected error "${expected}", but got result ${result}`);
      } else {
        if (Math.abs(result - (expected as number)) > 0.0001) {
          throw new Error(`FAILED: "${expr}" -> Expected ${expected}, got ${result}`);
        }
      }
    } catch (e: any) {
      if (typeof expected === 'string') {
        if (!e.message.includes(expected)) {
          throw new Error(`FAILED: "${expr}" -> Expected error containing "${expected}", got "${e.message}"`);
        }
      } else {
        throw new Error(`CRASH: "${expr}" -> ${e.message}`);
      }
    }
  };

  try {
    // A. Valid Math
    check('2+2', 4.0);
    check('5--2', 7.0);
    check('10%3', 1.0);
    check('-.5+1', 0.5);

    // B. Strict Error Boundaries
    check('5+', 'Incomplete');
    check('.', 'Invalid Number');
    check('5/0', 'Div by Zero');
    check('5%0', 'Div by Zero');
    check('10%3%2', 'Ambiguous');
    check('5.5%2', 'Int Mod Only');
    check('2*(3+2', "Missing ')'");
    check('+', "Unexpected");
    
    console.log('--- All Logic Checks Passed ---');
  } catch (e) {
    console.error(e);
    alert(`FATAL LOGIC ERROR: ${e}`);
  }
};

const KEYPAD = [
  'C', '(', ')', '⌫',
  '7', '8', '9', '÷',
  '4', '5', '6', 'x',
  '1', '2', '3', '-',
  '.', '0', '%', '+'
];

export default function App() {
  const [input, setInput] = useState('0');
  const [result, setResult] = useState('0');
  const [isErrorState, setIsErrorState] = useState(false);
  const [freshResult, setFreshResult] = useState(false);
  
  // Animation state triggers
  const [shakeKey, setShakeKey] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);

  // Run tests on mount
  useEffect(() => {
    runStrictTests();
  }, []);

  const triggerShake = () => {
    setShakeKey(prev => prev + 1);
    // Vibrate if available
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const calculateResult = useCallback(() => {
    try {
      const clean = input.replace(/x/g, '*').replace(/÷/g, '/');
      if (!clean) return;

      const parser = new Parser(clean);
      const evalResult = parser.parse();

      if (!isFinite(evalResult)) throw new ParserException("Div by Zero");
      if (isNaN(evalResult)) throw new ParserException("Math Error");

      let finalResult = "";
      if (evalResult % 1 === 0) {
        finalResult = evalResult.toString();
      } else {
        finalResult = evalResult.toFixed(6);
        // Remove trailing zeros
        finalResult = finalResult.replace(/\.?0+$/, "");
      }

      setResult(finalResult);
      setInput(finalResult);
      setFreshResult(true);
      setIsErrorState(false);
      setPulseKey(prev => prev + 1);

    } catch (e: any) {
      setResult(e.message || "Error");
      setIsErrorState(true);
      setFreshResult(false);
      triggerShake();
    }
  }, [input]);

  const canAddDecimal = (currentInput: string) => {
    if (!currentInput) return true;
    let lastOpIndex = -1;
    const ops = ['+', '-', 'x', '÷', '(', ')', '%'];
    for (let i = currentInput.length - 1; i >= 0; i--) {
      if (ops.includes(currentInput[i])) {
        lastOpIndex = i;
        break;
      }
    }
    const lastSegment = currentInput.substring(lastOpIndex + 1);
    return !lastSegment.includes('.');
  };

  const onButtonPressed = useCallback((value: string) => {
    // Reset error state on valid input (unless clearing)
    if (isErrorState) {
       if (value !== 'C' && value !== '⌫') {
         setResult('0');
         setIsErrorState(false);
         // If input was error text, reset it. But logic below usually uses `input` state which might be valid.
         // Actually in calculateResult we set input to result. So if error, input is "Error".
         // We need to clear it.
         setInput(value === '.' || ['+', '-', 'x', '÷', '%'].includes(value) ? '0' : ''); 
       }
    }

    if (value === 'C') {
      setInput('0');
      setResult('0');
      setFreshResult(false);
      setIsErrorState(false);
      return;
    }

    if (value === '⌫') {
      if (freshResult) {
        setFreshResult(false);
        if (input.length > 0) {
           setInput(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        } else {
           setInput('0');
        }
      } else {
        if (isErrorState) {
           setInput('0');
           setResult('0');
           setIsErrorState(false);
        } else {
          setInput(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        }
      }
      return;
    }

    if (value === '=') {
      calculateResult();
      return;
    }

    const isOperator = ['+', '-', 'x', '÷', '%'].includes(value);

    // Handle Fresh State (start new calc or continue)
    if (freshResult) {
       setFreshResult(false);
       if (!isOperator) {
          setInput(''); // Clear input if typing number
          // State update batching in React means we can't rely on 'input' immediately being empty below
          // So we handle the append logic with a local override
          if (value === '.') {
             setInput('0.');
             return;
          }
          setInput(value);
          return;
       }
       // If operator, continue with current input (which is the result)
    }

    // Since state updates are async, we use functional updates or handle logic carefully.
    setInput(prev => {
       // If we just cleared error state and reset input manually above, 'prev' might be stale in this render cycle? 
       // React batching should be fine, but let's be safe.
       // Actually, if isErrorState was true, we handled it.
       
       let next = (isErrorState || prev === 'Error') ? '' : prev;
       if (next === '0' && !isOperator && value !== '.') {
         next = '';
       }

       // A. Prevent Leading Unary Plus
       if (next === '' && value === '+') {
         triggerShake();
         return prev;
       }

       // Smart Parenthesis
       if (value === ')') {
         const open = (next.match(/\(/g) || []).length;
         const close = (next.match(/\)/g) || []).length;
         if (close >= open) {
           triggerShake();
           return prev;
         }
       }

       if (value === '.') {
         if (canAddDecimal(next)) {
           if (next === '' || ['+', '-', 'x', '÷', '(', '%'].includes(next.slice(-1))) {
             return next + "0.";
           }
           return next + ".";
         } else {
           triggerShake();
           return prev;
         }
       }
       else if (isOperator) {
         const last = next.slice(-1);
         const lastIsOp = ['+', '-', 'x', '÷', '%'].includes(last);

         if (lastIsOp) {
           if (value === '-') {
             // Allow negative after operator (e.g., 5 * -2)
             if (last !== '-') return next + value;
             triggerShake();
             return prev;
           } else {
             // Replace last operator
             return next.slice(0, -1) + value;
           }
         }
       }
       
       return next + value;
    });

  }, [freshResult, isErrorState, calculateResult]);

  // Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let val = '';
      const key = e.key;

      if (key === 'Enter' || key === '=') val = '=';
      else if (key === 'Backspace') val = '⌫';
      else if (key === 'Escape') val = 'C';
      else if (['0','1','2','3','4','5','6','7','8','9'].includes(key)) val = key;
      else if (key === '+') val = '+';
      else if (key === '-') val = '-';
      else if (key === '*') val = 'x';
      else if (key === '/') val = '÷';
      else if (key === '.') val = '.';
      else if (key === '%') val = '%';
      else if (key === '(') val = '(';
      else if (key === ')') val = ')';

      if (val) {
        e.preventDefault();
        onButtonPressed(val);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onButtonPressed]);

  return (
    <div className="h-screen w-screen overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#FDEBF7] via-[#E0C3FC] to-[#8EC5FC]">
      
      {/* Entrance Animation */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", duration: 0.8, bounce: 0.4 }}
        className="relative w-full max-w-md h-[95vh] sm:h-[90vh] p-4 sm:p-6"
      >
        {/* Glass Container */}
        <div 
          className="w-full h-full rounded-[40px] flex flex-col overflow-hidden backdrop-blur-xl border border-white/50 shadow-2xl"
          style={{ backgroundColor: AppTheme.colors.glassWhite }}
        >
          {/* Header */}
          <div className="flex justify-end p-6">
            <div className="w-3 h-3 rounded-full bg-red-400/50 mr-2"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400/50 mr-2"></div>
            <div className="w-3 h-3 rounded-full bg-green-400/50"></div>
          </div>

          {/* Display Area */}
          <div className="flex-1 flex flex-col justify-end items-end px-8 pb-4 space-y-2">
             {/* Input (Scrollable) */}
             <motion.div 
                className="w-full text-right overflow-x-auto whitespace-nowrap scrollbar-hide text-2xl sm:text-3xl font-normal tracking-wider opacity-60"
                style={{ color: AppTheme.colors.textLight }}
                animate={{ x: shakeKey % 2 === 0 ? 0 : [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.4 }}
             >
               {input}
             </motion.div>

             {/* Result */}
             <motion.div
               key={pulseKey}
               initial={{ scale: 1 }}
               animate={{ scale: [1, 1.1, 1] }}
               transition={{ duration: 0.3 }}
               className="w-full text-right font-bold break-all"
             >
               <span 
                 className="text-5xl sm:text-6xl"
                 style={{ color: isErrorState ? AppTheme.colors.textError : AppTheme.colors.textDark }}
               >
                 {result}
               </span>
             </motion.div>
          </div>

          {/* Keypad */}
          <div className="flex-[1.5] p-6 pb-8">
            <div className="grid grid-cols-4 gap-3 sm:gap-4 h-full">
              {KEYPAD.map((btn) => {
                 const isOp = ['÷', 'x', '-', '+', '%', '(', ')'].includes(btn);
                 const isAction = ['C', '⌫'].includes(btn);
                 const bg = isOp 
                    ? AppTheme.colors.btnOperator 
                    : isAction 
                      ? AppTheme.colors.btnAction 
                      : AppTheme.colors.btnDefault;
                 const color = isOp ? '#FFF' : '#333';

                 return (
                   <JigglyButton
                     key={btn}
                     text={btn}
                     backgroundColor={bg}
                     textColor={color}
                     onTap={() => onButtonPressed(btn)}
                     className="w-full h-full min-h-[60px] text-xl sm:text-2xl"
                   />
                 );
              })}
              
              {/* Equal Button spans full width */}
              <div className="col-span-4 mt-2 h-20">
                <JigglyButton
                  text="="
                  backgroundColor={AppTheme.colors.btnEqual}
                  textColor={AppTheme.colors.textDark}
                  onTap={() => onButtonPressed('=')}
                  className="w-full h-full text-3xl"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}