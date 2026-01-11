import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

interface DisguiseScreenProps {
  onUnlock: () => void;
}

export function DisguiseScreen({ onUnlock }: DisguiseScreenProps) {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);
  const [pinBuffer, setPinBuffer] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyPin = useCallback(async (pin: string) => {
    if (isVerifying || pin.length < 4) return;
    
    setIsVerifying(true);
    try {
      const response = await apiRequest("POST", "/api/user/preferences/verify-pin", { pin });
      const result = await response.json();
      
      if (result.valid) {
        onUnlock();
      }
    } catch (error) {
      // Silently fail - app continues as calculator
    } finally {
      setIsVerifying(false);
    }
  }, [isVerifying, onUnlock]);

  const handleNumber = useCallback((num: string) => {
    // Adiciona ao buffer de PIN
    const newPinBuffer = pinBuffer + num;
    setPinBuffer(newPinBuffer);
    
    // Verifica PIN quando tem 4+ dígitos (verificação assíncrona no backend)
    if (newPinBuffer.length >= 4 && newPinBuffer.length <= 6) {
      verifyPin(newPinBuffer);
    }
    
    // Limita o buffer e reseta se muito longo
    if (newPinBuffer.length > 6) {
      setPinBuffer(num);
    }

    // Lógica da calculadora normal
    if (waitingForSecondOperand) {
      setDisplay(num);
      setWaitingForSecondOperand(false);
    } else {
      setDisplay(display === "0" ? num : display + num);
    }
  }, [display, waitingForSecondOperand, pinBuffer, verifyPin]);

  const handleOperation = useCallback((op: string) => {
    const currentValue = parseFloat(display);
    
    if (previousValue !== null && operation && !waitingForSecondOperand) {
      const result = calculate(previousValue, currentValue, operation);
      setDisplay(String(result));
      setPreviousValue(result);
    } else {
      setPreviousValue(currentValue);
    }
    
    setOperation(op);
    setWaitingForSecondOperand(true);
    setPinBuffer("");
  }, [display, previousValue, operation, waitingForSecondOperand]);

  const calculate = (first: number, second: number, op: string): number => {
    switch (op) {
      case "+": return first + second;
      case "-": return first - second;
      case "×": return first * second;
      case "÷": return second !== 0 ? first / second : 0;
      default: return second;
    }
  };

  const handleEquals = useCallback(() => {
    if (previousValue !== null && operation) {
      const currentValue = parseFloat(display);
      const result = calculate(previousValue, currentValue, operation);
      setDisplay(String(result));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForSecondOperand(false);
    }
    setPinBuffer("");
  }, [display, previousValue, operation]);

  const handleClear = useCallback(() => {
    setDisplay("0");
    setPreviousValue(null);
    setOperation(null);
    setWaitingForSecondOperand(false);
    setPinBuffer("");
  }, []);

  const handlePercent = useCallback(() => {
    const currentValue = parseFloat(display);
    setDisplay(String(currentValue / 100));
    setPinBuffer("");
  }, [display]);

  const handleToggleSign = useCallback(() => {
    const currentValue = parseFloat(display);
    setDisplay(String(-currentValue));
    setPinBuffer("");
  }, [display]);

  const handleDecimal = useCallback(() => {
    if (!display.includes(".")) {
      setDisplay(display + ".");
    }
    setPinBuffer("");
  }, [display]);

  const buttonClass = "h-16 text-2xl font-semibold rounded-full transition-all active:scale-95";
  const numberButtonClass = `${buttonClass} bg-muted hover:bg-muted/80 text-foreground`;
  const operationButtonClass = `${buttonClass} bg-primary hover:bg-primary/80 text-primary-foreground`;
  const functionButtonClass = `${buttonClass} bg-muted/60 hover:bg-muted/40 text-foreground`;

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50">
      {/* Header com título discreto */}
      <div className="flex items-center justify-center h-12 border-b border-border">
        <span className="text-sm font-medium text-muted-foreground">Calculadora</span>
      </div>
      
      {/* Display */}
      <div className="flex-1 flex items-end justify-end px-6 pb-4">
        <span 
          className="text-6xl font-light text-foreground truncate max-w-full"
          data-testid="display-calculator"
        >
          {display.length > 12 ? parseFloat(display).toExponential(5) : display}
        </span>
      </div>
      
      {/* Teclado */}
      <div className="grid grid-cols-4 gap-3 p-4 pb-8">
        <Button 
          className={functionButtonClass} 
          onClick={handleClear}
          data-testid="button-clear"
        >
          {display === "0" ? "AC" : "C"}
        </Button>
        <Button 
          className={functionButtonClass} 
          onClick={handleToggleSign}
          data-testid="button-toggle-sign"
        >
          ±
        </Button>
        <Button 
          className={functionButtonClass} 
          onClick={handlePercent}
          data-testid="button-percent"
        >
          %
        </Button>
        <Button 
          className={operationButtonClass} 
          onClick={() => handleOperation("÷")}
          data-testid="button-divide"
        >
          ÷
        </Button>

        {["7", "8", "9"].map((num) => (
          <Button 
            key={num}
            className={numberButtonClass} 
            onClick={() => handleNumber(num)}
            data-testid={`button-num-${num}`}
          >
            {num}
          </Button>
        ))}
        <Button 
          className={operationButtonClass} 
          onClick={() => handleOperation("×")}
          data-testid="button-multiply"
        >
          ×
        </Button>

        {["4", "5", "6"].map((num) => (
          <Button 
            key={num}
            className={numberButtonClass} 
            onClick={() => handleNumber(num)}
            data-testid={`button-num-${num}`}
          >
            {num}
          </Button>
        ))}
        <Button 
          className={operationButtonClass} 
          onClick={() => handleOperation("-")}
          data-testid="button-subtract"
        >
          −
        </Button>

        {["1", "2", "3"].map((num) => (
          <Button 
            key={num}
            className={numberButtonClass} 
            onClick={() => handleNumber(num)}
            data-testid={`button-num-${num}`}
          >
            {num}
          </Button>
        ))}
        <Button 
          className={operationButtonClass} 
          onClick={() => handleOperation("+")}
          data-testid="button-add"
        >
          +
        </Button>

        <Button 
          className={`${numberButtonClass} col-span-2`} 
          onClick={() => handleNumber("0")}
          data-testid="button-num-0"
        >
          0
        </Button>
        <Button 
          className={numberButtonClass} 
          onClick={handleDecimal}
          data-testid="button-decimal"
        >
          ,
        </Button>
        <Button 
          className={operationButtonClass} 
          onClick={handleEquals}
          data-testid="button-equals"
        >
          =
        </Button>
      </div>
    </div>
  );
}
