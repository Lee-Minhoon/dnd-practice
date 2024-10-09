import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  UniqueIdentifier,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback, useRef, useState } from "react";
import { Item, createItems } from "../../utilities/createRange";
import DroppableContainer from "../DroppableContainer";
import SortableItem from "../SortableItem";

type Items = Record<UniqueIdentifier, Item[]>;

const PLACEHOLDER_ID = "placeholder";

export default function MultipleContainers() {
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));
  const [items, setItems] = useState<Items>({
    A: createItems(20),
    B: createItems(10),
    C: createItems(5),
    D: createItems(20),
  });
  const [containers, setContainers] = useState(
    Object.keys(items) as UniqueIdentifier[]
  );
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id);
    setClonedItems(items);
  };

  const onDragCancel = () => {
    if (clonedItems) {
      // Reset items to their original state in case items have been
      // Dragged across containers
      setItems(clonedItems);
    }

    setActiveId(null);
    setClonedItems(null);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    const overId = over?.id;

    if (overId == null || active.id in items) {
      return;
    }

    const overContainer = findContainer(overId);
    const activeContainer = findContainer(active.id);

    if (!overContainer || !activeContainer) {
      return;
    }

    if (activeContainer !== overContainer) {
      setItems((items) => {
        const activeItems = items[activeContainer];
        const overItems = items[overContainer];
        const overIndex = overItems.findIndex((item) => item.id === overId);
        const activeIndex = activeItems.findIndex(
          (item) => item.id === active.id
        );

        let newIndex: number;

        if (overId in items) {
          newIndex = overItems.length + 1;
        } else {
          const isBelowOverItem =
            over &&
            active.rect.current.translated &&
            active.rect.current.translated.top >
              over.rect.top + over.rect.height;

          const modifier = isBelowOverItem ? 1 : 0;

          newIndex =
            overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
        }

        return {
          ...items,
          [activeContainer]: items[activeContainer].filter(
            (item) => item.id !== active.id
          ),
          [overContainer]: [
            ...items[overContainer].slice(0, newIndex),
            items[activeContainer][activeIndex],
            ...items[overContainer].slice(
              newIndex,
              items[overContainer].length
            ),
          ],
        };
      });
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (active.id in items && over?.id) {
      setContainers((containers) => {
        const activeIndex = containers.indexOf(active.id);
        const overIndex = containers.indexOf(over.id);

        return arrayMove(containers, activeIndex, overIndex);
      });
    }

    const activeContainer = findContainer(active.id);

    if (!activeContainer) {
      setActiveId(null);
      return;
    }

    const overId = over?.id;

    if (overId == null) {
      setActiveId(null);
      return;
    }

    // if (overId === PLACEHOLDER_ID) {
    //   const newContainerId = getNextContainerId();

    //   unstable_batchedUpdates(() => {
    //     setContainers((containers) => [...containers, newContainerId]);
    //     console.log(
    //       "setting items onDragEnd when overId === PLACEHOLDER_ID"
    //     );
    //     setItems((items) => ({
    //       ...items,
    //       [activeContainer]: items[activeContainer].filter(
    //         (id) => id !== activeId
    //       ),
    //       [newContainerId]: [active.id],
    //     }));
    //     setActiveId(null);
    //   });
    //   return;
    // }

    const overContainer = findContainer(overId);

    if (overContainer) {
      const activeIndex = items[activeContainer].findIndex(
        (item) => item.id === active.id
      );
      const overIndex = items[overContainer].findIndex(
        (item) => item.id === overId
      );

      if (activeIndex !== overIndex) {
        console.log("setting items onDragEnd when activeIndex !== overIndex");
        setItems((items) => ({
          ...items,
          [overContainer]: arrayMove(
            items[overContainer],
            activeIndex,
            overIndex
          ),
        }));
      }
    }

    setActiveId(null);
  };

  const [clonedItems, setClonedItems] = useState<Items | null>(null);

  const findContainer = (id: UniqueIdentifier) => {
    if (id in items) {
      return id;
    }

    return Object.keys(items).find((key) =>
      items[key].some((item) => item.id === id)
    );
  };

  /**
   * Custom collision detection strategy optimized for multiple containers
   *
   * - First, find any droppable containers intersecting with the pointer.
   * - If there are none, find intersecting containers with the active draggable.
   * - If there are no intersecting containers, return the last matched intersection
   *
   */
  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      if (activeId && activeId in items) {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (container) => container.id in items
          ),
        });
      }

      // Start by finding any intersecting droppable
      const pointerIntersections = pointerWithin(args);
      const intersections =
        pointerIntersections.length > 0
          ? // If there are droppables intersecting with the pointer, return those
            pointerIntersections
          : rectIntersection(args);
      let overId = getFirstCollision(intersections, "id");

      if (overId != null) {
        if (overId in items) {
          const containerItems = items[overId];

          // If a container is matched and it contains items (columns 'A', 'B', 'C')
          if (containerItems.length > 0) {
            // Return the closest droppable within that container
            overId = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (container) =>
                  container.id !== overId &&
                  containerItems.some((item) => item.id === container.id)
              ),
            })[0]?.id;
          }
        }

        lastOverId.current = overId;

        return [{ id: overId }];
      }

      // If no droppable is matched, return the last match
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [activeId, items]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div
        style={{
          display: "inline-grid",
          boxSizing: "border-box",
          padding: 20,
          gridAutoFlow: "row",
        }}
      >
        <SortableContext
          items={[...containers, PLACEHOLDER_ID]}
          strategy={verticalListSortingStrategy}
        >
          {containers.map((containerId) => (
            <DroppableContainer
              key={containerId}
              id={containerId}
              label={`Column ${containerId}`}
              items={items[containerId]}
            >
              <SortableContext
                items={items[containerId]}
                strategy={rectSortingStrategy}
              >
                {items[containerId].map((item, index) => {
                  return (
                    <SortableItem
                      key={item.id}
                      id={item.id}
                      index={index}
                      handle={false}
                    />
                  );
                })}
              </SortableContext>
            </DroppableContainer>
          ))}
          <DroppableContainer
            id={PLACEHOLDER_ID}
            items={[]}
            // onClick={handleAddColumn}
            placeholder
          >
            + Add column
          </DroppableContainer>
        </SortableContext>
      </div>
    </DndContext>
  );

  // function handleAddColumn() {
  //   const newContainerId = getNextContainerId();

  //   unstable_batchedUpdates(() => {
  //     setContainers((containers) => [...containers, newContainerId]);
  //     setItems((items) => ({
  //       ...items,
  //       [newContainerId]: [],
  //     }));
  //   });
  // }

  // function getNextContainerId() {
  //   const containerIds = Object.keys(items);
  //   const lastContainerId = containerIds[containerIds.length - 1];

  //   return String.fromCharCode(lastContainerId.charCodeAt(0) + 1);
  // }
}
