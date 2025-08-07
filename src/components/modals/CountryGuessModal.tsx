import { useEffect, useRef } from "react";
import styled from "styled-components";

interface Props {
  selectedCountry: any;
  guess: string;
  setGuess: (val: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

const CountryGuessModal = ({ selectedCountry, guess, setGuess, onSubmit, onClose }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedCountry && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedCountry]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSubmit();
    }
  };

  if (!selectedCountry) return;

  return (
    <Overlay onClick={onClose}>
      <ModalBox>
        <Input
          ref={inputRef}
          type="text"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your guess and press Enter"
          autoComplete="off"
        />
      </ModalBox>
    </Overlay>
  );
};

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalBox = styled.div`
  display: flex;
  background-color: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  min-width: 300px;
  text-align: center;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px;
  font-size: 16px;
  border-radius: 6px;
  border: 1.5px solid #ccc;
  outline: none;
  transition: border-color 0.2s;

  &:focus {
    border-color: #007bff;
  }
`;

export default CountryGuessModal;
