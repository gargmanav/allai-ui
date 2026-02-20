import { useEffect } from "react";
import { useLocation } from "wouter";

export default function QuotesPage() {
  const [_, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/contractor?view=quotes");
  }, [setLocation]);

  return null;
}
