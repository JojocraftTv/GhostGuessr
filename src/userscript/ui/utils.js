export const hasClassPrefix = (element, prefix) => {
  if (!element) return false;
  return Array.from(element.classList).some((name) =>
    name.startsWith(prefix),
  );
};

export const getClassByPrefix = (element, prefix) => {
  if (!element) return null;
  return Array.from(element.classList).find((name) =>
    name.startsWith(prefix),
  );
};
