import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ScoreActionContent,
  scoreActionDirectionFromAmount,
  scoreActionToneClass,
  scoreDirectionOptionClass,
} from "@/components/shared/score-action-visual";

describe("score action visual", () => {
  it("uses one semantic direction across action and option variants", () => {
    expect(scoreActionDirectionFromAmount(500)).toBe("add");
    expect(scoreActionDirectionFromAmount(-500)).toBe("subtract");
    expect(scoreActionToneClass("add")).toBe("eq-score-action-add");
    expect(scoreActionToneClass("subtract")).toBe("eq-score-action-subtract");
    expect(scoreDirectionOptionClass("add")).toBe("eq-score-direction-add");
    expect(scoreDirectionOptionClass("subtract")).toBe(
      "eq-score-direction-subtract",
    );
  });

  it("shows explicit text and signs so meaning never depends on color", () => {
    render(
      <div>
        <ScoreActionContent direction="add" value="+500" />
        <ScoreActionContent
          direction="subtract"
          secondaryText="ยืนยันก่อนบันทึก"
          value="-500"
        />
      </div>,
    );

    expect(screen.getByText("เพิ่มคะแนน")).toBeInTheDocument();
    expect(screen.getByText("+500")).toBeInTheDocument();
    expect(screen.getByText("ลดคะแนน")).toBeInTheDocument();
    expect(screen.getByText("-500")).toBeInTheDocument();
    expect(screen.getByText("ยืนยันก่อนบันทึก")).toBeInTheDocument();
  });
});
