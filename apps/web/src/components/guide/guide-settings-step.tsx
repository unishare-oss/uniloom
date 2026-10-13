import { GuideSection } from "@/components/guide/guide-section";

/** Step 10: settings, labels and trash. */
export const GuideSettingsStep = () => {
  return (
    <GuideSection id="settings" step={10} title="Settings, labels and trash">
      <ul>
        <li>
          <b>Settings:</b> Owners change the project name, whether a checklist
          is required, the checklist minimum and maximum, and whether Members
          may claim tickets. Others can see the values. New limits apply from
          then on; existing checklists stay as they are.
        </li>
        <li>
          <b>Labels:</b> Owners create labels with a colour and an optional
          group. Labels in the same group can&rsquo;t be on one ticket together.
        </li>
        <li>
          <b>Trash:</b> deleted tickets go here. Owners and Managers can restore
          them.
        </li>
      </ul>
    </GuideSection>
  );
};
