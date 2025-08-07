import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import countriesList from "../../data/countriesList";

interface Props {
  selectedCountry: any;
  guess: string;
  setGuess: (val: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

const CountryGuessModal = ({ selectedCountry, guess, setGuess, onSubmit, onClose }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filteredCountries, setFilteredCountries] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  useEffect(() => {
    if (selectedCountry && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedCountry]);

  useEffect(() => {
    const matches = countriesList.filter((country: string) =>
      country.toLowerCase().includes(guess.trim().toLowerCase())
    );
    setFilteredCountries(matches.slice(0, 5));
    setHighlightedIndex(-1);
  }, [guess]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredCountries]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredCountries.length === 0 ? -1 : (prev + 1) % filteredCountries.length
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredCountries.length === 0 ? -1 : prev <= 0 ? filteredCountries.length - 1 : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!guess.trim()) return;

      if (highlightedIndex >= 0 && filteredCountries[highlightedIndex]) {
        // User selected with arrow keys
        handleSelect(filteredCountries[highlightedIndex]);
      } else {
        // User typed and pressed enter directly
        setFilteredCountries([]);
        onSubmit();
      }
    }
  };

  const handleSelect = (country: string) => {
    setGuess(country);
    if (filteredCountries.length > 0) {
      setFilteredCountries([]);
    }
    onSubmit();
  };

  if (!selectedCountry) return;

  return (
    <Overlay
      onClick={() => {
        onClose();
        if (filteredCountries.length > 0) {
          setFilteredCountries([]);
        }
      }}
    >
      <ModalBox onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          type="text"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your guess and press Enter"
          autoComplete="off"
        />
        {guess && filteredCountries.length > 0 && (
          <Suggestions>
            {filteredCountries.map((country, index) => (
              <SuggestionItem
                key={country}
                onClick={() => handleSelect(country)}
                $highlighted={index === highlightedIndex}
              >
                {country}
              </SuggestionItem>
            ))}
          </Suggestions>
        )}
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
  flex-direction: column;
  background-color: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  min-width: 300px;
  text-align: center;
`;

const Input = styled.input`
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

const Suggestions = styled.ul`
  list-style: none;
  padding: 0;
  margin: 10px 0 0;
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: white;
`;

const SuggestionItem = styled.li<{ $highlighted: boolean }>`
  padding: 8px 12px;
  cursor: pointer;
  background-color: ${({ $highlighted }) => ($highlighted ? "#e0e0e0" : "white")};

  &:hover {
    background-color: #f2f2f2;
  }
`;

export default CountryGuessModal;
